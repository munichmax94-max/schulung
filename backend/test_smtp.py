#!/usr/bin/env python3

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_smtp_connection():
    """Test SMTP connection with Hostinger"""
    
    smtp_server = os.environ.get("SMTP_SERVER")
    smtp_port = int(os.environ.get("SMTP_PORT", 465))
    smtp_username = os.environ.get("SMTP_USERNAME") 
    smtp_password = os.environ.get("SMTP_PASSWORD")
    sender_email = os.environ.get("SENDER_EMAIL")
    
    print(f"Testing SMTP with:")
    print(f"Server: {smtp_server}")
    print(f"Port: {smtp_port}")
    print(f"Username: {smtp_username}")
    print(f"Sender: {sender_email}")
    print(f"Password: {'*' * len(smtp_password) if smtp_password else 'None'}")
    
    try:
        # Create test message
        msg = MIMEMultipart()
        msg["Subject"] = "Test E-Mail vom Schulungsportal"
        msg["From"] = f"Schulungsportal <{sender_email}>"
        msg["To"] = "maximilian.enenkel@web.de"
        
        body = "Dies ist eine Test-E-Mail zur Überprüfung der SMTP-Konfiguration."
        msg.attach(MIMEText(body, "plain"))
        
        print("\n🔍 Verbindungstest startet...")
        
        # Create secure SSL context
        context = ssl.create_default_context()
        
        # Connect using SSL
        with smtplib.SMTP_SSL(smtp_server, smtp_port, context=context) as server:
            print("✅ SSL-Verbindung erfolgreich")
            
            # Login
            server.login(smtp_username, smtp_password)
            print("✅ SMTP-Login erfolgreich")
            
            # Send email
            server.sendmail(sender_email, "maximilian.enenkel@web.de", msg.as_string())
            print("✅ Test-E-Mail erfolgreich versendet!")
            
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ Authentifizierungsfehler: {e}")
        return False
    except smtplib.SMTPConnectError as e:
        print(f"❌ Verbindungsfehler: {e}")
        return False
    except smtplib.SMTPException as e:
        print(f"❌ SMTP-Fehler: {e}")
        return False
    except Exception as e:
        print(f"❌ Allgemeiner Fehler: {e}")
        return False

if __name__ == "__main__":
    print("🧪 SMTP-Test für Schulungsportal")
    print("=" * 40)
    
    success = test_smtp_connection()
    
    if success:
        print("\n🎉 SMTP-Test erfolgreich! E-Mail-Versendung funktioniert.")
    else:
        print("\n💥 SMTP-Test fehlgeschlagen. Bitte Konfiguration überprüfen.")