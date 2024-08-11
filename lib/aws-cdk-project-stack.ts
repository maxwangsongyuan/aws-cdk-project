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
    const lambdaFunction = new Function(this, 'LeetCodeLambdaFunction', {
      runtime: Runtime.PYTHON_3_12,
      description: 'leetCode progress retrieval lambda function',
      handler: 'leetcode_progress_retrieval_lambda_function.lambda_handler',
      code: Code.fromAsset('lambda'),
      role: lambdaRole,
      logRetention: RetentionDays.ONE_MONTH,
      memorySize: 1024,
      timeout: Duration.minutes(15),
      layers: [lambdaLayer], // Attach the Lambda Layer
    });

    // Create SES Lambda function
    const sesLambdaFunction = new Function(this, 'SesLambdaFunction', {
      runtime: Runtime.PYTHON_3_12,
      description: 'SES email notification lambda function',
      handler: 'email_notification_lambda_function.handler',
      code: Code.fromAsset('lambda'),
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