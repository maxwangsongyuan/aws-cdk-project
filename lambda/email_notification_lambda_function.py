import boto3
import json
import os

def handler(event, context):
    ses = boto3.client('ses')
    subject = "Leetcode Status Report on " + event['yearDateMonth']

    try:
        # Access the lambda_output from the event directly
        lambda_output = event['lambda_output']['value']
        stats = json.loads(lambda_output['body'])

        # Format the email body as an HTML table
        html_body = f"""
        <html>
        <body>
            <h2>Leetcode Status Report</h2>
            <h3>Solved Summary</h3>
            <table border="1" style="border-collapse: collapse;">
                <tr>
                    <th>Difficulty</th>
                    <th>Solved</th>
                    <th>Submissions</th>
                </tr>
        """

        for difficulty in stats['solvedSummary']['acSubmissionNum']:
            corresponding_total = next((item for item in stats['solvedSummary']['totalSubmissionNum'] if item['difficulty'] == difficulty['difficulty']), None)
            if corresponding_total:
                html_body += f"""
                <tr>
                    <td>{difficulty['difficulty']}</td>
                    <td>{difficulty['count']}</td>
                    <td>{corresponding_total['submissions']}</td>
                </tr>
                """

        html_body += """
            </table>
            <h3>Latest Submissions</h3>
            <table border="1" style="border-collapse: collapse;">
                <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Language</th>
                    <th>Timestamp</th>
                </tr>
        """

        for submission in stats['latestSubmissions']['submission']:
            html_body += f"""
                <tr>
                    <td>{submission['title']}</td>
                    <td>{submission['statusDisplay']}</td>
                    <td>{submission['lang']}</td>
                    <td>{submission['timestamp']}</td>
                </tr>
            """

        html_body += """
            </table>
        </body>
        </html>
        """

        # Send the email
        response = ses.send_email(
            Source=os.environ['SES_SOURCE_EMAIL'],
            Destination={
                'ToAddresses': [os.environ['SES_DESTINATION_EMAIL']],
            },
            Message={
                'Subject': {
                    'Data': subject
                },
                'Body': {
                    'Html': {
                        'Data': html_body
                    }
                }
            }
        )

        # Return statement to indicate success
        return {
            'statusCode': 200,
            'body': {'message': 'Email sent successfully'}
        }
    except Exception as e:
        # Return statement to indicate failure
        return {
            'statusCode': 500,
            'body': {'message': 'Failed to send email', 'error': str(e)}
        }