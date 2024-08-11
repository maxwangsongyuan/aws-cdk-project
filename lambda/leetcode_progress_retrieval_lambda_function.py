import json
import requests

def lambda_handler(event, context):
    # Define the base URL for the API
    base_url = "https://alfa-leetcode-api.onrender.com"

    # Specify the LeetCode username
    username = "maxwsy"

    # Make a request to fetch user statistics (latest 10 submissions)
    submission_response = requests.get(f"{base_url}/{username}/acSubmission?limit=10")

    # Make a request to fetch solved question summary
    solved_response = requests.get(f"{base_url}/{username}/solved")

    # Check if both requests were successful
    if submission_response.status_code == 200 and solved_response.status_code == 200:
        submission_stats = submission_response.json()
        solved_stats = solved_response.json()

        combined_stats = {
            'solvedSummary': solved_stats,
            'latestSubmissions': submission_stats
        }

        return {
            'statusCode': 200,
            'body': json.dumps(combined_stats)
        }
    else:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to fetch statistics'})
        }