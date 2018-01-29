import thread
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
def send_email( alertLevel , msg ):

	wTN = datetime.now( eastern_tz )
	wNow = wTN.strftime( "%Y-%m-%d %H:%M:%S" )
	wTimeMsg = wNow + "\n\n" + msg
	send_slack_message( "Motion @@ " + wNow )

	try:
		#yag.send( securityDetails.toEmail , str( alertLevel ) , "Motion @@ " + wNow )
		print( "sent email" )
	except Exception as e:
		print e
		print( "failed to send email" )
		send_slack_error( "failed to send email" )

class TenvisVideo():

	def __init__( self ):

		send_slack_message( "python --> newMotion.py --> init()" )

		self.FRAME_POOL = [ None ]*1800
		self.EVENT_POOL = [ None ]*10

		self.total_motion = 0
		self.video_index = 0
		self.last_email_time = None

		self.MIN_MOTION_FRAMES = 4

		wSYS_LEN = len( sys.argv )
		self.MIN_MOTION_SECONDS = ( int( sys.argv[1] ) , 1 )[ wSYS_LEN > 1 ]
		self.MOTION_EVENTS_ACCEPTABLE = ( int( sys.argv[2] ) , 2 )[ wSYS_LEN > 2 ]
		self.MIN_TIME_ACCEPTABLE = ( int( sys.argv[3] ) , 3 )[ wSYS_LEN > 3 ] 
		self.TIME_COOLOFF = ( int( sys.argv[4] ) , 8 )[ wSYS_LEN > 4 ]

		print "MIN_MOTION_SECONDS === " + str( self.MIN_MOTION_SECONDS )
		print "MOTION_EVENTS_ACCEPTABLE === " + str( self.MOTION_EVENTS_ACCEPTABLE )
		print "MIN_TIME_ACCEPTABLE === " + str( self.MIN_TIME_ACCEPTABLE )
		print "TIME_COOLOFF === " + str( self.TIME_COOLOFF )

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

		fourcc = cv2.VideoWriter_fourcc( *"mp4v" )
		w_path = os.path.join( videoImagesPath , "latestMotion%d.mp4" % self.video_index )
		print w_path
		
		videoWriter = cv2.VideoWriter( w_path , fourcc , 30 , ( 500 , 500 ) )		
		for i , frame in enumerate( wTMP_COPY ):
			videoWriter.write( frame )
		videoWriter.release()

		self.video_index += 1
		wTMP_COPY = None
		print "done writing video"

	def motionTracking( self ):

		avg = None
		firstFrame = None

		min_area = 500
		delta_thresh = 5

		motionCounter = 0

		while( self.w_Capture.isOpened() ):

			if self.last_email_time is not None:
				wNow = datetime.now( eastern_tz )
				self.elapsedTimeFromLastEmail = int( ( wNow - self.last_email_time ).total_seconds() )
				if self.elapsedTimeFromLastEmail < self.emailCoolOff:
					print "inside email cooloff - passing"
					continue

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

			( cnts , _ ) = cv2.findContours( thresh.copy() , cv2.RETR_EXTERNAL , cv2.CHAIN_APPROX_SIMPLE )
			for c in cnts:
				if cv2.contourArea( c ) < min_area:
					motionCounter = 0
					continue
				self.currentMotion = True
				motionCounter += 1

			if motionCounter >= self.MIN_MOTION_FRAMES:
				wNow = datetime.now( eastern_tz )
				self.nowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )
				send_slack_message( self.nowString + " === motion record" )
				print "setting new motion record"
				self.total_motion += 1
				motionCounter = 0

			if self.total_motion >= self.MOTION_EVENTS_ACCEPTABLE:
				print "this is the motion event we care about ???"				
				self.total_motion = 0
				wNow = datetime.now( eastern_tz )
				wNowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )
				#send_slack_message( wNowString + " === totalMotion >= MOTION_EVENTS_ACCEPTABLE" )
				self.EVENT_POOL.append( wNow )
				self.EVENT_POOL.pop( 0 )

				# Check Time Difference with Last Event 
				if self.EVENT_POOL[ 8 ] is not None:
					wElapsedTime_1 = int( ( wNow - self.EVENT_POOL[ 8 ] ).total_seconds() )
					print "( Tier - 0 ) Elapsed Time === " + str( wElapsedTime_1 )
					if wElapsedTime_1 >= self.MIN_TIME_ACCEPTABLE and wElapsedTime_1 <= self.TIME_COOLOFF:
						print "Motion Event within Custom Time Range"
						print "ALERT !!!!"
					else:
						print "event outside of cooldown window .... reseting .... "
						#send_slack_message( self.nowString + " === event outside of cooldown window .... reseting .... " )


				for i , val in enumerate( self.EVENT_POOL ):
					if val is not None:
						print str(i) + " === " + val.strftime( "%Y-%m-%d %H:%M:%S" )
					else:
						print "None"


			# self.FRAME_POOL.insert( 0 , frame )
			# self.FRAME_POOL.pop()

			cv2.imshow( "frame" , frame )
			cv2.imshow( "Thresh" , thresh )
			#cv2.imshow( "Frame Delta" , frameDelta )
			if cv2.waitKey( 1 ) & 0xFF == ord( "q" ):
				break

		self.cleanup()

TenvisVideo()