import os
#import numpy as np
import cv2
from time import sleep
from flask import Flask, render_template , Response , send_file , make_response


#https://stackoverflow.com/questions/21197638/create-a-mjpeg-stream-from-jpeg-images-in-python

videoPath = os.path.abspath( os.path.join( __file__ , ".." , ".." , "videos" ) )
framePath = os.path.join( videoPath , "frame.jpg"  )
print framePath
frameByteStringPath = os.path.join( videoPath , "frameByteString.txt"  )

app = Flask(__name__)

def live_image():
	frame = open( framePath , "rb" )
	frameB = frame.read()

	frame.close()
	return frameB

@app.route('/')
def get_image():
	#return send_file( framePath , mimetype='image/jpeg')
	response = make_response( live_image() )
	response.headers['Content-Type'] = 'image/jpeg'
	response.headers[ 'mimetype' ] = 'multipart/x-mixed-replace; boundary=frame'
	#response.headers['Content-Disposition'] = 'attachment; filename=img.jpg'
	return response

app.run( host='0.0.0.0' , debug=False )


'''
def write_bytes():
	image = cv2.imread( framePath )
	imageBytes = image.tobytes()
	print imageBytes
	newFile = open( frameByteStringPath , "wb" )
	newFile.write( imageBytes )
	newFile.close()

#write_bytes()


def get_frame():
	#image = cv2.imread( framePath )
	#x = image.tobytes()
	#print x
	#return x
	#frameBytes = open( frameByteStringPath , "rb" )
	#rawBytes = frameBytes.read()
	#frameBytes.close()
	#return rawBytes

	frame = open( framePath , "rb" )
	frameB = frame.read()

	frame.close()
	return frameB



def gen_image():
    #while True:
    frame = get_frame()
    #yield (b'--frame\r\n'b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
    return (b'--frame\r\n'b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')




@app.route('/')
def index():
	return Response( get_frame() , mimetype='multipart/x-mixed-replace; boundary=frame')


def gen2():
    while True:
        frame = get_frame()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response( gen2() ,
                    mimetype='multipart/x-mixed-replace; boundary=frame')

'''