import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
import logging
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = os.environ.get("SMTP_SERVER")
        self.smtp_port = int(os.environ.get("SMTP_PORT", 465))
        self.smtp_use_ssl = os.environ.get("SMTP_USE_SSL", "true").lower() == "true"
        self.smtp_username = os.environ.get("SMTP_USERNAME")
        self.smtp_password = os.environ.get("SMTP_PASSWORD")
        self.sender_email = os.environ.get("SENDER_EMAIL")
        self.sender_name = os.environ.get("SENDER_NAME", "Schulungsportal")
        
        # Check if SMTP is configured
        self.is_configured = all([
            self.smtp_server, 
            self.smtp_username, 
            self.smtp_password, 
            self.sender_email
        ])
        
        if not self.is_configured:
            logger.warning("SMTP configuration is incomplete. Email features will be disabled.")
    
    def send_email(self, to_email: str, subject: str, html_content: str, plain_content: Optional[str] = None) -> bool:
        """
        Send an email using SMTP
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of the email
            plain_content: Plain text alternative (optional)
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.is_configured:
            logger.error("Cannot send email: SMTP is not configured")
            return False
            
        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.sender_name} <{self.sender_email}>"
            msg["To"] = to_email
            
            # Create plain text and HTML parts
            if plain_content:
                part1 = MIMEText(plain_content, "plain", "utf-8")
                msg.attach(part1)
            
            part2 = MIMEText(html_content, "html", "utf-8")
            msg.attach(part2)
            
            # Create secure connection and send email
            if self.smtp_use_ssl:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, context=context) as server:
                    server.login(self.smtp_username, self.smtp_password)
                    server.sendmail(self.sender_email, to_email, msg.as_string())
            else:
                with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                    server.starttls()
                    server.login(self.smtp_username, self.smtp_password)
                    server.sendmail(self.sender_email, to_email, msg.as_string())
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            print(f"DEBUG: Email error for {to_email}: {str(e)}")  # Debug output
            return False
    
    def send_access_key_email(self, to_email: str, access_key: str, recipient_name: str = "") -> bool:
        """
        Send access key email with German content
        
        Args:
            to_email: Recipient email address
            access_key: The access key to send
            recipient_name: Optional recipient name
            
        Returns:
            bool: True if email sent successfully
        """
        if not self.is_configured:
            logger.error("Cannot send access key email: SMTP is not configured")
            return False
            
        subject = "Ihr Access-Key für das Schulungsportal"
        
        # Greeting
        greeting = f"Liebe/r {recipient_name}," if recipient_name else "Liebe/r Schulungsteilnehmer/in,"
        
        # HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ihr Access-Key für das Schulungsportal</title>
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f8fafc;
                }}
                .container {{
                    background-color: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                }}
                .logo {{
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border-radius: 12px;
                    margin: 0 auto 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    font-weight: bold;
                }}
                .title {{
                    color: #1f2937;
                    font-size: 24px;
                    font-weight: 700;
                    margin: 0;
                }}
                .access-key-box {{
                    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                    border: 2px solid #10b981;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 25px 0;
                }}
                .access-key {{
                    font-family: 'Courier New', monospace;
                    font-size: 20px;
                    font-weight: bold;
                    color: #059669;
                    letter-spacing: 2px;
                    margin: 10px 0;
                }}
                .instructions {{
                    background-color: #f3f4f6;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }}
                .instructions h3 {{
                    color: #374151;
                    margin-top: 0;
                }}
                .step {{
                    margin: 15px 0;
                    padding-left: 25px;
                    position: relative;
                }}
                .step::before {{
                    content: counter(step-counter);
                    counter-increment: step-counter;
                    position: absolute;
                    left: 0;
                    top: 0;
                    background-color: #10b981;
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                }}
                .instructions ol {{
                    counter-reset: step-counter;
                    list-style: none;
                    padding: 0;
                }}
                .button {{
                    display: inline-block;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    text-decoration: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    margin: 20px 0;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    color: #6b7280;
                    font-size: 14px;
                }}
                .warning {{
                    background-color: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">📚</div>
                    <h1 class="title">Schulungsportal</h1>
                    <p>Willkommen zu Ihrer Schulung</p>
                </div>
                
                <p>{greeting}</p>
                
                <p>herzlich willkommen! Sie haben Zugang zu unserem Schulungsportal erhalten. Hier ist Ihr persönlicher Access-Key:</p>
                
                <div class="access-key-box">
                    <p><strong>Ihr Access-Key:</strong></p>
                    <div class="access-key">{access_key}</div>
                    <p><small>Bitte bewahren Sie diesen Key sicher auf</small></p>
                </div>
                
                <div class="instructions">
                    <h3>So greifen Sie auf Ihre Schulungen zu:</h3>
                    <ol>
                        <li class="step">Besuchen Sie das Schulungsportal</li>
                        <li class="step">Geben Sie Ihren Access-Key ein</li>
                        <li class="step">Klicken Sie auf "Zugriff freischalten"</li>
                        <li class="step">Beginnen Sie mit Ihrer Schulung</li>
                    </ol>
                </div>
                
                <div style="text-align: center;">
                    <a href="{os.environ.get('FRONTEND_URL', 'https://app.emergent.host')}" class="button">
                        Jetzt zum Schulungsportal
                    </a>
                </div>
                
                <div class="warning">
                    <strong>Wichtige Hinweise:</strong>
                    <ul>
                        <li>Teilen Sie Ihren Access-Key nicht mit anderen Personen</li>
                        <li>Der Key ist für Ihre persönliche Nutzung bestimmt</li>
                        <li>Bei Problemen kontaktieren Sie uns unter info@invasio.de</li>
                    </ul>
                </div>
                
                <div class="footer">
                    <p>
                        Diese E-Mail wurde automatisch generiert.<br>
                        Bei Fragen wenden Sie sich an: <strong>info@invasio.de</strong>
                    </p>
                    <p>
                        <small>© {datetime.now().year} Schulungsportal - Alle Rechte vorbehalten</small>
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text alternative
        plain_content = f"""
        {greeting}

        herzlich willkommen! Sie haben Zugang zu unserem Schulungsportal erhalten.

        Ihr Access-Key: {access_key}

        So greifen Sie auf Ihre Schulungen zu:
        1. Besuchen Sie: https://edukeys.preview.emergentagent.com
        2. Geben Sie Ihren Access-Key ein: {access_key}
        3. Klicken Sie auf "Zugriff freischalten"
        4. Beginnen Sie mit Ihrer Schulung

        Wichtige Hinweise:
        - Teilen Sie Ihren Access-Key nicht mit anderen Personen
        - Der Key ist für Ihre persönliche Nutzung bestimmt
        - Bei Problemen kontaktieren Sie uns unter info@invasio.de

        Viel Erfolg bei Ihrer Schulung!

        Bei Fragen: info@invasio.de
        © {datetime.now().year} Schulungsportal
        """
        
        return self.send_email(to_email, subject, html_content, plain_content)
    
    def send_bulk_access_keys(self, recipients: List[dict], access_keys: List[str]) -> dict:
        """
        Send access keys to multiple recipients
        
        Args:
            recipients: List of dicts with 'email' and optional 'name'
            access_keys: List of access keys corresponding to recipients
            
        Returns:
            dict: Results with success/failure counts and details
        """
        if len(recipients) != len(access_keys):
            raise ValueError("Recipients and access_keys lists must have the same length")
        
        results = {
            "total": len(recipients),
            "successful": 0,
            "failed": 0,
            "failures": []
        }
        
        for i, (recipient, key) in enumerate(zip(recipients, access_keys)):
            email = recipient.get("email")
            name = recipient.get("name", "")
            
            try:
                success = self.send_access_key_email(email, key, name)
                if success:
                    results["successful"] += 1
                    logger.info(f"Successfully sent access key to {email}")
                else:
                    results["failed"] += 1
                    results["failures"].append({
                        "email": email,
                        "error": "Email sending failed"
                    })
            except Exception as e:
                results["failed"] += 1
                results["failures"].append({
                    "email": email,
                    "error": str(e)
                })
                logger.error(f"Failed to send access key to {email}: {str(e)}")
        
        return results

# Global email service instance - initialized lazily
_email_service_instance = None

def get_email_service():
    """Get email service instance (lazy initialization)"""
    global _email_service_instance
    if _email_service_instance is None:
        _email_service_instance = EmailService()
    return _email_service_instance

# Alias for backward compatibility
email_service = get_email_service()