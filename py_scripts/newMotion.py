import numpy as np
import cv2
import sys
import os
import signal
import imutils
from slackclient import SlackClient
import yagmail
from datetime import datetime , timedelta
from time import localtime, strftime , sleep
from pytz import timezone
eastern_tz = timezone( "US/Eastern" )

def signal_handler( signal , frame ):
	wStr1 = "newMotion.py closed , Signal = " + str( signal )
	print( wStr1 )
	send_slack_error( wStr1 )
	sys.exit(0)
signal.signal( signal.SIGABRT , signal_handler )
signal.signal( signal.SIGFPE , signal_handler )
signal.signal( signal.SIGILL , signal_handler )
signal.signal( signal.SIGSEGV , signal_handler )
signal.signal( signal.SIGTERM , signal_handler )
signal.signal( signal.SIGINT , signal_handler )

securityDetailsPath = os.path.abspath( os.path.join( __file__ , ".." , ".." ) )
sys.path.append( securityDetailsPath )
import securityDetails

slack_client = SlackClient( securityDetails.slack_token )
def send_slack_error( wErrString ):
	try:
		slack_client.api_call(
			"chat.postMessage",
			channel="#raspn-err",
			text=wErrString
		)
	except:
		print( "failed to send slack error message" )

def send_slack_message( wMsgString ):
	try:
		slack_client.api_call(
			"chat.postMessage",
			channel="#raspi-neuro",
			text=wMsgString
		)
	except:
		print( "failed to send slack message" )		

#yagmail.register( securityDetails.fromGmail , securityDetails.gmailPass )
yag = yagmail.SMTP( securityDetails.fromGmail , securityDetails.gmailPass )
def send_email( alertLevel , msg ):

	wTN = datetime.now( eastern_tz )
	wNow = wTN.strftime( "%Y-%m-%d %H:%M:%S" )
	wTimeMsg = wNow + "\n\n" + msg
	send_slack_message( "Motion @@ " + wNow )

	try:
		yag.send( securityDetails.toEmail , str( alertLevel ) , "Motion @@ " + wNow )
		print( "sent email" )
	except Exception as e:
		print e
		print( "failed to send email" )
		send_slack_error( "failed to send email" )

class TenvisVideo():

	def __init__( self ):

		send_slack_message( "python --> newMotion.py --> init()" )

		self.startMotionTime = None
		self.currentMotionTime = None
		self.cachedMotionEvent = None
		self.sentEmailTime = None
		self.emailCoolOff = 150

		self.FRAME_POOL = [ None ]*1800

		try:
			self.minMotionSeconds = int( sys.argv[1] )
		except:
			self.minMotionSeconds = 1
		try:
			self.totalMotionAcceptable = int( sys.argv[2] )
		except:
			self.totalMotionAcceptable = 2
		try:
			self.totalTimeAcceptable = int( sys.argv[3] )
		except:
			self.totalTimeAcceptable = 3
		try:
			self.totalTimeAcceptableCoolOff = int( sys.argv[4] )
		except:
			self.totalTimeAcceptableCoolOff = 8
		
		print "starting with " + str( self.minMotionSeconds ) + " " + str(self.totalMotionAcceptable) + " " + str(self.totalTimeAcceptable) + " " + str(self.totalTimeAcceptableCoolOff)

		self.coolOffTime = 3
		self.elapsedTime = 0
		self.totalMotion = 0
				
		self.w_Capture = cv2.VideoCapture( 0 )
		#signal.pause()
		self.motionTracking()

	def cleanup( self ):
		self.w_Capture.release()
		cv2.destroyAllWindows()
		send_slack_error( "newMotion.py --> cleanup()" )

	def motionTracking( self ):

		avg = None
		firstFrame = None

		min_area = 500
		delta_thresh = 5

		motionCounter = 0
		min_motion_frames = 8

		while( self.w_Capture.isOpened() ):

			( grabbed , frame ) = self.w_Capture.read()
			text = "No Motion"

			if not grabbed:
				break

			frame = imutils.resize( frame , width = 500 )
			gray = cv2.cvtColor( frame , cv2.COLOR_BGR2GRAY )
			gray = cv2.GaussianBlur( gray , ( 21 , 21 ) , 0 )

			if firstFrame is None:
				firstFrame = gray
				continue

			if avg is None:
				avg = gray.copy().astype("float")
				continue

			cv2.accumulateWeighted( gray , avg , 0.5 )
			frameDelta = cv2.absdiff( gray , cv2.convertScaleAbs(avg) )

			thresh = cv2.threshold( frameDelta , delta_thresh , 255 , cv2.THRESH_BINARY )[1]
			thresh = cv2.dilate( thresh , None , iterations=2 )
			
			# try:
			# 	# New api call is different
			# 	( image , cnts , _ ) = cv2.findContours( thresh.copy() , cv2.RETR_EXTERNAL , cv2.CHAIN_APPROX_SIMPLE )
			# except:
			(cnts, _) = cv2.findContours( thresh.copy() , cv2.RETR_EXTERNAL , cv2.CHAIN_APPROX_SIMPLE )

			for c in cnts:

				if cv2.contourArea( c ) < min_area:
					continue

				if self.sentEmailTime is not None:
					cT = datetime.now()
					eT = cT - self.sentEmailTime
					eT = int(eT.total_seconds())
					if eT < self.emailCoolOff:
						continue
					else:
						self.sentEmailTime = None

				text = "Motion"
				
				if self.startMotionTime is None:
					print "setting new motion record"
					wTN = datetime.now( eastern_tz )
					wNow = wTN.strftime( "%Y-%m-%d %H:%M:%S" )
					send_slack_message( "motion record @@ " + wNow )
					self.startMotionTime = datetime.now()

			if text == "Motion":

				motionCounter += 1

				if motionCounter >= min_motion_frames:

					self.currentMotionTime = datetime.now()
					self.elapsedTime =  self.currentMotionTime - self.startMotionTime
					self.elapsedTime = int(self.elapsedTime.total_seconds())

					motionCounter = 0
					
			else:
				motionCounter = 0


			if self.elapsedTime >= self.coolOffTime:
				self.cachedMotionEvent = self.startMotionTime
				self.totalMotion = self.totalMotion + 1
				self.startMotionTime = None
				self.elapsedTime = 0

			if self.totalMotion >= self.totalMotionAcceptable:
				now = datetime.now( eastern_tz )
				wNow = now.strftime( "%Y-%m-%d %H:%M:%S" )
				print "totalMotion >= totalMotionAcceptable"
				print wNow
				send_slack_message( "totalMotion >= totalMotionAcceptable @@ " + wNow )
				eT = now - self.cachedMotionEvent
				eS = int( eT.total_seconds() )
				if eS >= self.totalTimeAcceptable and eS <= self.totalTimeAcceptableCoolOff:
					#print eS
					#print "we need to alert"
					self.cachedMotionEvent = None
					send_email( self.totalMotion , "Haley is Moving" )
					self.totalMotion = 0
					self.sentEmailTime = now
				elif eS >= self.totalTimeAcceptableCoolOff:
					print "event outside of cooldown window .... reseting .... "
					send_slack_message( "event outside of cooldown window .... reseting .... " )
					self.cachedMotionEvent = None
					self.totalMotion = 0


			self.FRAME_POOL.insert( 0 , frame )
			self.FRAME_POOL.pop()

			# cv2.imshow( "frame" , frame )
			# cv2.imshow( "Thresh" , thresh )
			# cv2.imshow( "Frame Delta" , frameDelta )
			# if cv2.waitKey( 1 ) & 0xFF == ord( "q" ):
			# 	break

		self.cleanup()

TenvisVideo()