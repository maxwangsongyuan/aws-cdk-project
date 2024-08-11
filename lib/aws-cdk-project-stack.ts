import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
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
//
//     // Generate the current date and time
//     const now = new Date();
//     const dateString = now.toISOString().replace(/[:\-]/g, '').replace(/\..+/, '').toLowerCase();
//
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

    // Create Lambda function
    const lambdaFunction = new Function(this, 'LambdaFunction', {
      runtime: Runtime.PYTHON_3_9,
      description: 'lambda function',
      handler: 'index.handler',
      code: Code.fromInline(
      `
import json
import requests

def lambda_handler(event, context):
    # Define the base URL for the API
    base_url = "https://leetcode-stats-api.herokuapp.com"

    # Specify the LeetCode username
    username = "maxwsy"

    # Make a request to fetch user statistics
    response = requests.get(f"{base_url}/{username}")

    # Check if the request was successful
    if response.status_code == 200:
        stats = response.json()
        return {
            'statusCode': 200,
            'body': json.dumps(stats)
        }
    else:
        return {
            'statusCode': response.status_code,
            'body': json.dumps({'error': 'Failed to fetch statistics'})
        }
      `),
      role: lambdaRole,
      logRetention: RetentionDays.ONE_MONTH,
      memorySize: 1024,
      timeout: Duration.minutes(15),
    });

    // Create Step Function and define the Lambda invocation state using dynamic input parameters
    const lambdaInvoke = new LambdaInvoke(this, 'InvokeLambdaStep', {
      lambdaFunction,
      payload: TaskInput.fromObject({}),
      outputPath: '$.Payload',
    });

    // Define a success state
    const successState = new Succeed(this, 'SuccessState');

    // Define a failure state
    const failureState = new Fail(this, 'FailureState', {
      cause: 'Lambda function invocation failed or query failed',
      error: 'Invoke error or Query error',
    });

    // Decision state to check the result of the Lambda function
    const decisionState = new Choice(this, 'DecisionState')
      .when(Condition.numberEquals('$.statusCode', 200), successState)
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