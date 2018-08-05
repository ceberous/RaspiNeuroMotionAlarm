import os , sys , time
from twilio.rest import Client

securityDetailsPath = os.path.abspath( os.path.join( __file__ , ".." , ".." ) )
sys.path.append( securityDetailsPath )
import securityDetails

TwilioClient = Client( securityDetails.twilio_sid , securityDetails.twilio_auth_token )

new_call = TwilioClient.calls.create( url=securityDetails.twilio_response_server_url , to=securityDetails.toSMSExtraNumber , from_=securityDetails.fromSMSNumber , method="POST" )