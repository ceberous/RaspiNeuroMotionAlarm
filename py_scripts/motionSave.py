import threading
import numpy as np
import cv2
import sys
import os
import signal
import imutils
import json

from datetime import datetime , timedelta
from time import localtime, strftime , sleep
from pytz import timezone
eastern_tz = timezone( "US/Eastern" )

from twilio.rest import Client
from websocket import create_connection


def signal_handler( signal , frame ):
	wStr1 = "newMotion.py closed , Signal = " + str( signal )
	print( wStr1 )
	broadcast_error( wStr1 )
	sys.exit(0)
signal.signal( signal.SIGABRT , signal_handler )
signal.signal( signal.SIGFPE , signal_handler )
signal.signal( signal.SIGILL , signal_handler )
signal.signal( signal.SIGSEGV , signal_handler )
signal.signal( signal.SIGTERM , signal_handler )
signal.signal( signal.SIGINT , signal_handler )

videoPath = os.path.abspath( os.path.join( __file__ , ".." , ".." , "videos" ) )
framePathBase = os.path.abspath( os.path.join( __file__ , ".." , ".." , "client" ) )
frameLiveImagePath = os.path.abspath( os.path.join( framePathBase , "frame.jpeg" ) )

try:
	os.makedirs( videoPath )
except OSError:
	pass
securityDetailsPath = os.path.abspath( os.path.join( __file__ , ".." , ".." ) )
sys.path.append( securityDetailsPath )
import securityDetails

ws = create_connection( "ws://localhost:6161" )

TwilioClient = Client( securityDetails.twilio_sid , securityDetails.twilio_auth_token )

def voice_call_me():
	new_call = TwilioClient.calls.create( url=securityDetails.twilio_response_server_url , to=securityDetails.toSMSExtraNumber , from_=securityDetails.fromSMSNumber , method="POST" )

def voice_call_dad():
	new_call = TwilioClient.calls.create( url=securityDetails.twilio_response_server_url , to=securityDetails.toSMSNumber , from_=securityDetails.fromSMSNumber , method="POST" )

def voice_call_house():
	new_call = TwilioClient.calls.create( url=securityDetails.twilio_response_server_url , to=securityDetails.toHouseNumber , from_=securityDetails.fromSMSNumber , method="POST" )


def send_twilio_sms( wMsgString ):
	try:
		message = TwilioClient.messages.create( securityDetails.toSMSNumber ,
			body=wMsgString ,
			from_=securityDetails.fromSMSNumber ,
		)
	except Exception as e:
		print ( e )
		print ( "failed to send sms" )
		broadcast_error( "failed to send sms" )


def send_twilio_extra_sms( wMsgString ):
	try:
		message = TwilioClient.messages.create( securityDetails.toSMSExtraNumber ,
			body=wMsgString ,
			from_=securityDetails.fromSMSNumber ,
		)
	except Exception as e:
		print ( e )
		print ( "failed to send extra sms" )
		broadcast_error( "failed to send extra sms" )


def send_web_socket_message( wType , wMsgString ):
	xJString = json.dumps( { "type": wType , "message": wMsgString } )
	print ( xJString )
	ws.send( xJString )

def broadcast_error( wMsgString ):
	send_web_socket_message( "error" , wMsgString )

def broadcast_event( wMsgString ):
	send_web_socket_message( "event" , wMsgString )

def broadcast_record( wMsgString ):
	send_twilio_sms( wMsgString )
	send_web_socket_message( "record" , wMsgString )

def broadcast_extra_record( wMsgString ):
	print( "Broadcasting Extra Event" )
	send_web_socket_message( "extra" , wMsgString )
	#send_twilio_sms( wMsgString )
	send_twilio_extra_sms( wMsgString )

def broadcast_video_ready( wTodayDateString , wEventNumber ):
	print( "Today Date String == " + wTodayDateString )
	print( "Current Event Number == " + wEventNumber )
	send_web_socket_message( "videoReady" , wTodayDateString + "-" + wEventNumber )

def make_folder( path ):
	try:
		print( "Trying to Make Folder Path --> " )
		print( path )
		os.makedirs( path )
	except OSError as exception:
		pass
		#if exception.errno != errno.EEXIST:
			#raise

class TenvisVideo():

	def __init__( self ):

		broadcast_event( "python --> motionSave.py --> init()" )

		self.write_thread = None

		self.EVENT_TOTAL = -1
		self.EVENT_POOL = []
		self.ExtraAlertPool = [ datetime.now( eastern_tz ) - timedelta(minutes=59) ] * 8

		self.total_motion = 0
		self.video_index = 0
		self.last_email_time = None

		self.EMAIL_COOLOFF = 100
		#self.EMAIL_COOLOFF = 30

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
		print ( "MIN_MOTION_SECONDS === " + str( self.MIN_MOTION_SECONDS ) )
		print ( "MOTION_EVENTS_ACCEPTABLE === " + str( self.MOTION_EVENTS_ACCEPTABLE ) )
		print ( "MAX_TIME_ACCEPTABLE === " + str( self.MAX_TIME_ACCEPTABLE ) )
		print ( "MAX_TIME_ACCEPTABLE_STAGE_2 === " + str( self.MAX_TIME_ACCEPTABLE_STAGE_2 ) )


		## Setup Video Saving Folders

		# five seconds of video ?
		self.TOTAL_RECORDING_EVENT_FRAMES = 149
		self.FRAME_EVENT_COUNT = 0
		self.WRITING_EVENT_FRAMES = False
		make_folder( os.path.abspath( os.path.join( __file__ , ".." , ".." , "RECORDS" )  ) )

		self.TODAY_DATE_STRING = datetime.now( eastern_tz ).strftime( "%d%b%Y" ).upper()
		self.TODAY_DATE_FILE_PATH = os.path.abspath( os.path.join( __file__ , ".." , ".." , "RECORDS" , self.TODAY_DATE_STRING ) )
		make_folder( self.TODAY_DATE_FILE_PATH )
		self.CURRENT_EVENT_FOLDER_PATH = os.path.abspath( os.path.join( self.TODAY_DATE_FILE_PATH , "0" ) )
		make_folder( self.CURRENT_EVENT_FOLDER_PATH )

		# Start
		self.w_Capture = cv2.VideoCapture( 0 )
		self.motionTracking()

	def cleanup( self ):
		self.w_Capture.release()
		cv2.destroyAllWindows()
		broadcast_event( "newMotion.py --> cleanup()" )
		ws.close()

	def motionTracking( self ):

		avg = None
		firstFrame = None

		min_area = 500
		delta_thresh = 5

		motionCounter = 0

		while( self.w_Capture.isOpened() ):

			( grabbed , frame ) = self.w_Capture.read()

			if not grabbed:
				broadcast_error( "Can't Connect to PI Camera" )
				sleep( 1 )
				break

			frame = imutils.resize( frame , width = 500 )

			#temp adjustment for rando corner
			frame = frame[ 0:300 , 0:500 ]

			# https://stackoverflow.com/questions/39622281/capture-one-frame-from-a-video-file-after-every-10-seconds
			cv2.imwrite( frameLiveImagePath , frame )
			# if self.WRITING_EVENT_FRAMES == True:
			# 	if self.FRAME_EVENT_COUNT < self.TOTAL_RECORDING_EVENT_FRAMES:
			# 		if self.FRAME_EVENT_COUNT < 10:
			# 			cur_path = os.path.abspath( os.path.join( self.CURRENT_EVENT_FOLDER_PATH , '{}.jpg'.format( "00" + str( self.FRAME_EVENT_COUNT ) ) ) )
			# 		elif self.FRAME_EVENT_COUNT < 100:
			# 			cur_path = os.path.abspath( os.path.join( self.CURRENT_EVENT_FOLDER_PATH , '{}.jpg'.format( "0" + str( self.FRAME_EVENT_COUNT ) ) ) )
			# 		else:
			# 			cur_path = os.path.abspath( os.path.join( self.CURRENT_EVENT_FOLDER_PATH , '{}.jpg'.format( self.FRAME_EVENT_COUNT ) ) )
			# 		cv2.imwrite( cur_path , frame )
			# 		self.FRAME_EVENT_COUNT += 1
			# 	else:
			# 		if self.EVENT_TOTAL > 0:
			# 			broadcast_video_ready( self.TODAY_DATE_STRING , str( self.EVENT_TOTAL - 1 ) )

			# 		self.WRITING_EVENT_FRAMES = False
			# 		self.FRAME_EVENT_COUNT = 0
					#self.EVENT_TOTAL += 1
					#self.CURRENT_EVENT_FOLDER_PATH = os.path.abspath( os.path.join( self.TODAY_DATE_FILE_PATH , str( self.EVENT_TOTAL ) ) )
					#make_folder( self.CURRENT_EVENT_FOLDER_PATH )

			sleep( .1 )

			if self.last_email_time is not None:
				wNow = datetime.now( eastern_tz )
				self.nowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )
				self.elapsedTimeFromLastEmail = int( ( wNow - self.last_email_time ).total_seconds() )
				if self.elapsedTimeFromLastEmail < self.EMAIL_COOLOFF:
					#print "sleeping"
					pass
				else:
					broadcast_event( self.nowString + " === done sleeping" )
					self.last_email_time = None
				continue

			gray = cv2.cvtColor( frame , cv2.COLOR_BGR2GRAY )
			gray = cv2.GaussianBlur( gray , ( 21 , 21 ) , 0 )

			if firstFrame is None:
				firstFrame = gray
				continue

			if avg is None:
				avg = gray.copy().astype( "float" )
				continue

			cv2.accumulateWeighted( gray , avg , 0.5 )
			frameDelta = cv2.absdiff( gray , cv2.convertScaleAbs(avg) )

			thresh = cv2.threshold( frameDelta , delta_thresh , 255 , cv2.THRESH_BINARY )[1]
			thresh = cv2.dilate( thresh , None , iterations=2 )

			# Search for Movment
			( cnts , _ ) = cv2.findContours( thresh.copy() , cv2.RETR_EXTERNAL , cv2.CHAIN_APPROX_SIMPLE )
			for c in cnts:
				if cv2.contourArea( c ) < min_area:
					motionCounter = 0 # ???
					continue
				wNow = datetime.now( eastern_tz )
				self.nowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )
				motionCounter += 1

			# If Movement Is Greater than Threshold , create motion record
			if motionCounter >= self.MIN_MOTION_FRAMES:
				wNow = datetime.now( eastern_tz )
				self.nowString = wNow.strftime( "%Y-%m-%d %H:%M:%S" )
				broadcast_event( self.nowString + " === Motion Counter > MIN_MOTION_FRAMES" )
				#print "setting new motion record"

				# Check if this is "fresh" in a series of new motion records
				if len( self.EVENT_POOL ) > 1:
					wElapsedTime_x = int( ( self.EVENT_POOL[ -1 ] - self.EVENT_POOL[ -2 ] ).total_seconds() )
					if wElapsedTime_x > ( self.MAX_TIME_ACCEPTABLE_STAGE_2 * 2 ):
						broadcast_event( "Not Fresh , Resetting to 1st Event === " + str( wElapsedTime_x ) )
						self.EVENT_POOL = []
						self.total_motion = 0

				self.EVENT_POOL.append( wNow )
				if len( self.EVENT_POOL ) > 10:
					self.EVENT_POOL.pop( 0 )
				motionCounter = 0
				self.total_motion += 1

			# Once Total Motion Events Reach Threshold , create alert if timing conditions are met
			if self.total_motion >= self.MOTION_EVENTS_ACCEPTABLE:
				broadcast_event( self.nowString + " === Total Motion >= MOTION_EVENTS_ACCEPTABLE" )
				self.total_motion = 0

				wNeedToAlert = False

				# Condition 1.) Check Elapsed Time Between Last 2 Motion Events
				wElapsedTime_1 = int( ( self.EVENT_POOL[ -1 ] - self.EVENT_POOL[ 0 ] ).total_seconds() )
				if wElapsedTime_1 <= self.MAX_TIME_ACCEPTABLE:
					broadcast_event( "( Stage-1-Check ) === PASSED || Elapsed Time === " + str( wElapsedTime_1 ) )
					wNeedToAlert = True

				# Condition 2.) Check if there are multiple events in a greater window
				elif len( self.EVENT_POOL ) >= 3:
					wElapsedTime_2 = int( ( self.EVENT_POOL[ -1 ] - self.EVENT_POOL[ -3 ] ).total_seconds() )
					if wElapsedTime_2 <= self.MAX_TIME_ACCEPTABLE_STAGE_2:
						broadcast_event( "( Stage-2-Check ) === PASSED || Elapsed Time === " + str( wElapsedTime_2 ) )
						wNeedToAlert = True
					else:
						broadcast_event( "( Stage-2-Check ) === FAILED || Elapsed Time === " + str( wElapsedTime_2 ) )

				if wNeedToAlert == True:
					#print "ALERT !!!!"
					wNowString = self.EVENT_POOL[ -1 ].strftime( "%Y-%m-%d %H:%M:%S" )
					wTimeMsg = "Motion @@ " + wNowString
					broadcast_record( wTimeMsg )
					self.last_email_time = self.EVENT_POOL[ -1 ]
					self.EVENT_POOL = []

					self.WRITING_EVENT_FRAMES = True
					self.FRAME_EVENT_COUNT = 0
					self.EVENT_TOTAL += 1
					self.CURRENT_EVENT_FOLDER_PATH = os.path.abspath( os.path.join( self.TODAY_DATE_FILE_PATH , str( self.EVENT_TOTAL ) ) )
					make_folder( self.CURRENT_EVENT_FOLDER_PATH )

					try:
						self.ExtraAlertPool.insert( 0 , self.last_email_time )
						self.ExtraAlertPool.pop()
						num_records_in_10_minutes = 0
						num_records_in_20_minutes = 0
						num_records_in_30_minutes = 0
						for i , record in enumerate( self.ExtraAlertPool ):
							time_diff = int( ( self.last_email_time - record ).total_seconds() )
							if time_diff < 1800:
								num_records_in_30_minutes = num_records_in_30_minutes + 1
							if time_diff < 1200:
								num_records_in_20_minutes = num_records_in_20_minutes + 1
							if time_diff < 600:
								num_records_in_10_minutes = num_records_in_10_minutes + 1

						if num_records_in_10_minutes >= 3:
							wS1 = wNowString + " @@ " + str( num_records_in_10_minutes ) + " Records in 10 Minutes"
							broadcast_extra_record( wS1 )
						if num_records_in_20_minutes >= 5:
							voice_call_me()
							self.ExtraAlertPool = [ datetime.now( eastern_tz ) - timedelta( minutes=59 ) ] * 8
						if num_records_in_30_minutes >= 7:
							self.ExtraAlertPool = [ datetime.now( eastern_tz ) - timedelta( minutes=59 ) ] * 8
							#voice_call_dad()
						if num_records_in_30_minutes >= 9:
							self.ExtraAlertPool = [ datetime.now( eastern_tz ) - timedelta( minutes=59 ) ] * 8
							#voice_call_house()
					except Exception as e:
						print( "failed to process extra events que" )
						broadcast_error( "failed to process extra events que" )
						broadcast_error( e )


			#cv2.imshow( "frame" , frame )
			#cv2.imshow( "Thresh" , thresh )
			#cv2.imshow( "Frame Delta" , frameDelta )
			#if cv2.waitKey( 1 ) & 0xFF == ord( "q" ):
				#break

		self.cleanup()

TenvisVideo()