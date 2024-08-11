import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { Choice, Condition, Fail, StateMachine, Succeed, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';

export class AwsCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a unique bucket name using account ID, region, and date-time
    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // Generate the current date and time
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD

//     // Define the bucket name
//     const bucketName = `lambda-output-bucket-${account}-${region}`;
//
//     // Define the S3 bucket
//     const bucket = new Bucket(this, 'LambdaOutputBucket', {
//       bucketName: bucketName,
//       versioned: true,
//       removalPolicy: RemovalPolicy.RETAIN, // Automatically delete the bucket when the stack is deleted
//       autoDeleteObjects: false, // Automatically delete all objects in the bucket when the stack is deleted
//     });

    // Create IAM Role for Lambda
    const lambdaRole = new Role(this, `LambdaExecutionRole`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      roleName: `lambda-iam-role-${account}-${region}`,
    });

    // Attach policies to the Lambda role
    lambdaRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
        resources: ['arn:aws:s3:::lambda-output-bucket-864899851256-us-west-2'],
      }),
    );
    lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
        resources: ['arn:aws:s3:::lambda-output-bucket-864899851256-us-west-2/*'],
      }),
    );
    lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }),
    );

    // Create Lambda Layer from the ZIP file in S3, which includes the requests library
    // This is done manually by uploading the ZIP file to a S3 bucket
    const lambdaLayer = new LayerVersion(this, 'RequestsLayer', {
      code: Code.fromBucket(Bucket.fromBucketName(this, 'LayerBucket',
      'cdk-project-lambda-layer-zip-files'), //replace 'cdk-project-lambda-layer-zip-files' with your bucket name
      'requests_layer.zip'), //replace 'requests_layer.zip' with your file name
      compatibleRuntimes: [Runtime.PYTHON_3_12],
      description: 'A layer to include requests library',
    });

    // Create Lambda function
    const lambdaFunction = new Function(this, 'LambdaFunction', {
      runtime: Runtime.PYTHON_3_12,
      description: 'lambda function',
      handler: 'index.lambda_handler',
      code: Code.fromInline(
      `
import json
import requests

def lambda_handler(event, context):
    # Define the base URL for the API
    base_url = "https://alfa-leetcode-api.onrender.com"

    # Specify the LeetCode username
    username = "maxwsy"

    # Make a request to fetch user statistics (latest 3 submissions)
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
      `),
      role: lambdaRole,
      logRetention: RetentionDays.ONE_MONTH,
      memorySize: 1024,
      timeout: Duration.minutes(15),
      layers: [lambdaLayer], // Attach the Lambda Layer
    });

    // Create SES Lambda function
    const sesLambdaFunction = new Function(this, 'SesLambdaFunction', {
      runtime: Runtime.PYTHON_3_12,
      description: 'SES lambda function',
      handler: 'index.handler',
      code: Code.fromInline(
      `
import boto3
import json
import os

def handler(event, context):
    ses = boto3.client('ses')
    subject = "Leetcode Status Report on " + event['yearDateMonth']

    try:
        # Access the lambda_output from the event directly
        lambda_output = event['lambda_output']
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
      `),
      role: lambdaRole,
      logRetention: RetentionDays.ONE_MONTH,
      memorySize: 1024,
      timeout: Duration.minutes(5),
      environment: {
        SES_SOURCE_EMAIL: 'songyuanwangcode@gmail.com', // replace with your SES verified email
        SES_DESTINATION_EMAIL: 'songyuanwangcode@gmail.com' // replace with your destination email
      }
    });

    // Create Step Function and define the Lambda invocation state using dynamic input parameters
    const lambdaInvoke = new LambdaInvoke(this, 'InvokeLambdaStep', {
      lambdaFunction,
      payload: TaskInput.fromObject({
        'yearDateMonth': dateString
      }),
      outputPath: '$.Payload',
    });

    // SES Lambda invocation state
    const sesLambdaInvoke = new LambdaInvoke(this, 'InvokeSesLambdaStep', {
      lambdaFunction: sesLambdaFunction,
      payload: TaskInput.fromObject({
        'lambda_output': TaskInput.fromJsonPathAt('$'),
        'yearDateMonth': dateString
      }),
      outputPath: '$.Payload',
    });

    // Define a success state
    const successState = new Succeed(this, 'SuccessState');

    // Define a failure state
    const failureState = new Fail(this, 'FailureState', {
      cause: 'Lambda function invocation failed or query failed',
      error: 'Invoke error or Query error',
    });

    // Decision state to check the result of the initial Lambda function
    const decisionState = new Choice(this, 'DecisionState')
      .when(Condition.numberEquals('$.statusCode', 200), sesLambdaInvoke.addCatch(failureState).next(successState))
      .otherwise(failureState);


    // Define the workflow with error handling
    const definition = lambdaInvoke.addCatch(failureState, { resultPath: '$.error-info' }).next(decisionState);

    // Create the state machine with the defined workflow
    const stateMachine = new StateMachine(this, 'StateMachine', {
      stateMachineName: `LambdaInvocationStateMachine-${account}-${region}`,
      definition,
    });

    // Create EventBridge rule to trigger the Step Function
    new Rule(this, 'DailyTriggerRule', {
      schedule: Schedule.cron({ minute: '0', hour: '13', weekDay: 'MON-SUN' }),
      targets: [new SfnStateMachine(stateMachine)],
    });
  }
}