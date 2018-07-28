import os , sys
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse

securityDetailsPath = os.path.abspath( os.path.join( __file__ , ".." , ".." ) )
sys.path.append( securityDetailsPath )
import securityDetails

TwilioClient = Client( securityDetails.twilio_sid , securityDetails.twilio_auth_token )

new_call = TwilioClient.calls.create( to=securityDetails.toSMSExtraNumber , from_=securityDetails.fromSMSNumber , method="POST" )

print( "Serving TwiML" )
twiml_response = VoiceResponse()
twiml_response.say( "Hola! this is a test alert" )
twiml_response.hangup()
twiml_xml = twiml_response.to_xml()
print( "Generated twiml: {}".format( twiml_xml ) )