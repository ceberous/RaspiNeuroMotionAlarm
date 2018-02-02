import threading
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

videoPath = os.path.abspath( os.path.join( __file__ , ".." , ".." , "videos" ) )
framePath = os.path.abspath( os.path.join( __file__ , ".." , ".." , "client" , "frame.jpeg" ) )
try: 
	os.makedirs( videoPath )
except OSError:
	pass
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
def send_email( alertLevel , msg , wDateOBJ ):

	wNowString = wDateOBJ.strftime( "%Y-%m-%d %H:%M:%S" )
	wTimeMsg = wNowString + "\n\n" + msg
	send_slack_message( "Motion @@ " + wNowString )
	try:
		yag.send( securityDetails.toEmail , str( alertLevel ) , "Motion @@ " + wTimeMsg )
		print( "sent email" )
	except Exception as e:
		print e
		print( "failed to send email" )
		send_slack_error( "failed to send email" )


class TenvisVideo():

	def __init__( self ):

		send_slack_message( "python --> newMotion.py --> init()" )

		self.write_thread = None

		#self.FRAME_POOL = [ None ]*1800
		#wNow = datetime.now( eastern_tz )
		#self.EVENT_POOL = [ wNow ]*10
		self.EVENT_POOL = []

		self.total_motion = 0
		self.video_index = 0
		self.last_email_time = None

		self.EMAIL_COOLOFF = 150
		#self.EMAIL_COOLOFF = 20
		#self.EMAIL_COOLOFF = 10
		#self.MIN_MOTION_FRAMES = 4
		self.MIN_MOTION_FRAMES = 2
		try:
			self.MIN_MOTION_SECONDS = int( sys.argv[1] )
			self.MOTION_EVENTS_ACCEPTABLE = int( sys.argv[2] )
			self.MAX_TIME_ACCEPTABLE = int( sys.argv[3] )
			self.MAX_TIME_ACCEPTABLE_STAGE_2 = int( sys.argv[4] )
		except:
			self.MIN_MOTION_SECONDS = 1
			self.MOTION_EVENTS_ACCEPTABLE = 4
			self.MAX_TIME_ACCEPTABLE = 45
			self.MAX_TIME_ACCEPTABLE_STAGE_2 = 90
		print "MIN_MOTION_SECONDS === " + str( self.MIN_MOTION_SECONDS )
		print "MOTION_EVENTS_ACCEPTABLE === " + str( self.MOTION_EVENTS_ACCEPTABLE )
		print "MAX_TIME_ACCEPTABLE === " + str( self.MAX_TIME_ACCEPTABLE )
		print "MAX_TIME_ACCEPTABLE_STAGE_2 === " + str( self.MAX_TIME_ACCEPTABLE_STAGE_2 )

		self.w_Capture = cv2.VideoCapture( 0 )
		self.motionTracking()

	def cleanup( self ):
		self.w_Capture.release()
		cv2.destroyAllWindows()
		send_slack_error( "newMotion.py --> cleanup()" )

	def write_video( self ):
		# https://www.programcreek.com/python/example/72134/cv2.VideoWriter
		# https://video.stackexchange.com/questions/7903/how-to-losslessly-encode-a-jpg-image-sequence-to-a-video-in-ffmpeg
		print "starting to write video"
		wTMP_COPY = self.FRAME_POOL
		
		# try: 
		# 	os.makedirs( videoImagesPath )
		# except OSError:
		# 	pass
		# # save each frame as an image
		# for i , frame in enumerate( wTMP_COPY ):
		# 	w_name_1 = str( i )
		# 	w_name_1 = w_name_1.zfill( 4 )
		# 	#cv2.imwrite( os.path.join( videoImagesPath , "frame%d.jpg" % i ) , frame )
		# 	cv2.imwrite( os.path.join( videoImagesPath , "frame%s.jpg" % w_name_1 ) , frame )

		#fourcc = cv2.cv.CV_FOURCC(*"mp4v")
		#w_path = os.path.join( videoPath , "latestMotion%d.mp4" % self.video_index )
		
		#fourcc = cv2.cv.CV_FOURCC(*'XVID')
		#fourcc = cv2.cv.CV_FOURCC('i', 'Y', 'U', 'V')
		
		#fourcc = cv2.cv.CV_FOURCC(*"MJPG")
		fourcc = cv2.cv.CV_FOURCC('M','P','E','G')
		w_path = os.path.join( videoPath , "latestMotion%d.avi" % self.video_index )
		print w_path
		
		videoWriter = cv2.VideoWriter( w_path , fourcc , 30 , ( 500 , 500 ) )		
		for i , frame in enumerate( wTMP_COPY ):
			videoWriter.write( frame )
		videoWriter.release()

		self.video_index += 1
		wTMP_COPY = None
		del wTMP_COPY
		print "done writing video"
		return

	def motionTracking( self ):

		avg = None
		firstFrame = None

		min_area = 500
		delta_thresh = 5

		motionCounter = 0

		while( self.w_Capture.isOpened() ):

			( grabbed , frame ) = self.w_Capture.read()
			text = "No Motion"

			if not grabbed:
				break

			frame = imutils.resize( frame , width = 500 )
			cv2.imwrite( framePath , frame )
			sleep( .1 )			

			if self.last_email_time is not None:
				wNow = datetime.now( eastern_tz )
				self.nowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )
				self.elapsedTimeFromLastEmail = int( ( wNow - self.last_email_time ).total_seconds() )
				if self.elapsedTimeFromLastEmail < self.EMAIL_COOLOFF:
					wSleepDuration = ( self.EMAIL_COOLOFF - self.elapsedTimeFromLastEmail )
					print "inside email cooloff - sleeping( " + str( wSleepDuration ) + " )"
					send_slack_message( self.nowString + " === inside email cooloff - sleeping( " + str( wSleepDuration ) + " )" )
					sleep( wSleepDuration )
					print "done sleeping"
					wNow = datetime.now( eastern_tz )
					self.nowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )					
					send_slack_message( self.nowString + " === done sleeping" )					
					self.last_email_time = None
					continue

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

			# Search for Movment
			( cnts , _ ) = cv2.findContours( thresh.copy() , cv2.RETR_EXTERNAL , cv2.CHAIN_APPROX_SIMPLE )
			for c in cnts:
				if cv2.contourArea( c ) < min_area:
					motionCounter = 0
					continue
				wNow = datetime.now( eastern_tz )
				self.nowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )
				print self.nowString + " === motion record"
				#send_slack_message( self.nowString + " === motion record" )
				motionCounter += 1

			# If Movement Is Greater than Threshold , create motion record
			if motionCounter >= self.MIN_MOTION_FRAMES:
				wNow = datetime.now( eastern_tz )
				self.nowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )
				send_slack_message( self.nowString + " === Motiion Counter > MIN_MOTION_FRAMES" )
				print "setting new motion record"
				self.EVENT_POOL.append( wNow )
				if len( self.EVENT_POOL ) > 10:
					self.EVENT_POOL.pop( 0 )
				motionCounter = 0
				self.total_motion += 1

			# Once Total Motion Events Reach Threshold , create alert if timing conditions are met
			if self.total_motion >= self.MOTION_EVENTS_ACCEPTABLE:
				print "this is the motion event we care about ???"
				send_slack_message( self.nowString + " === this is the motion event we care about ???" )		
				self.total_motion = 0
				wNeedToAlert = False

				# Debugging
				print ""
				for i , val in enumerate( self.EVENT_POOL ):
					print str(i) + " === " + val.strftime( "%Y-%m-%d %H:%M:%S" )
				#Debugging

				# Condition 1.) Check Elapsed Time Between Last 2 Motion Events
				wElapsedTime_1 = int( ( self.EVENT_POOL[ -1 ] - self.EVENT_POOL[ 0 ] ).total_seconds() )
				print "\n( Stage-1-Check ) Elapsed Time === " + str( wElapsedTime_1 )
				send_slack_message( "( Stage-1-Check ) Elapsed Time === " + str( wElapsedTime_1 ) )
				#if wElapsedTime_1 >= self.MIN_TIME_ACCEPTABLE and wElapsedTime_1 <= self.TIME_COOLOFF:
				if wElapsedTime_1 <= self.MAX_TIME_ACCEPTABLE:
					wNeedToAlert = True

				# Condition 2.) Check if there are multiple events in a greater window
				if wNeedToAlert == False:
					if len( self.EVENT_POOL ) >= 3:
						wElapsedTime_2 = int( ( self.EVENT_POOL[ -1 ] - self.EVENT_POOL[ -3 ] ).total_seconds() )
						print "\n( Stage-2-Check ) Elapsed Time === " + str( wElapsedTime_2 )
						send_slack_message( "( Stage-2-Check ) Elapsed Time === " + str( wElapsedTime_2 ) )
						if wElapsedTime_2 <= self.MAX_TIME_ACCEPTABLE_STAGE_2:
							wNeedToAlert = True
					else:
						self.EVENT_POOL = []
						print "event outside of cooldown window .... reseting .... "
						send_slack_message( self.nowString + " === event outside of cooldown window .... reseting .... " )

				if wNeedToAlert == True:				
					print "Motion Event within Custom Time Range"
					print "ALERT !!!!"
					send_email( self.total_motion , "Haley is Moving" , self.EVENT_POOL[ -1 ] )
					self.last_email_time = self.EVENT_POOL[ -1 ]			
					self.EVENT_POOL = list( filter( lambda x: x > self.last_email_time , self.EVENT_POOL ) )
					print ""
					for i , val in enumerate( self.EVENT_POOL ):
						print str(i) + " === " + val.strftime( "%Y-%m-%d %H:%M:%S" )


			
			# self.FRAME_POOL.insert( 0 , frame )
			# self.FRAME_POOL.pop()
			# self.FRAME_POOL.append( frame )
			# if len( self.FRAME_POOL ) > 900:
			# 	self.FRAME_POOL.pop( 0 )

			# ret , GLOBAL_ACTIVE_FRAME_JPEG = cv2.imencode( '.jpg' , frame )
			# GLOBAL_ACTIVE_FRAME_JPEG = GLOBAL_ACTIVE_FRAME_JPEG.tobytes()
			# GLOBAL_ACTIVE_FRAME_JPEG = (b'--frame\r\n'b'Content-Type: image/jpeg\r\n\r\n' + GLOBAL_ACTIVE_FRAME_JPEG + b'\r\n\r\n')

			cv2.imshow( "frame" , frame )
			cv2.imshow( "Thresh" , thresh )
			#cv2.imshow( "Frame Delta" , frameDelta )
			if cv2.waitKey( 1 ) & 0xFF == ord( "q" ):
				break

		self.cleanup()

TenvisVideo()