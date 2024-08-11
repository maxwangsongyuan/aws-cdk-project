import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Duration, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';

export class AwsCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a unique bucket name using account ID, region, and date-time
    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // Generate the current date and time
    const now = new Date();
    const dateString = now.toISOString().replace(/[:\-]/g, '').replace(/\..+/, '').toLowerCase();

    // Define the S3 bucket with a unique name
    const bucket = new Bucket(this, 'LambdaOutputBucket', {
      bucketName: `lambda-output-bucket-${account}-${region}-${dateString}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete the bucket when the stack is deleted
      autoDeleteObjects: true, // Automatically delete all objects in the bucket when the stack is deleted
    });

    // Create IAM Role for Lambda
    const lambdaRole = new Role(this, `LambdaExecutionRole`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      roleName: `lambda-iam-role-${account}-${region}-${dateString}`,
    });

    // Attach policies to the Lambda role
    lambdaRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
        resources: [`${bucket.bucketArn}`],
      }),
    );
    lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
        resources: [`${bucket.bucketArn}/*`],
      }),
    );

    // Create Lambda function
    const lambdaFunction = new Function(
      this,
      'LambdaFunction',
      {
        runtime: Runtime.PYTHON_3_12,
        description: 'lambda function',
        handler: 'index.handler',
        code: Code.fromInline(`
          exports.handler = async function(event) {
            console.log("event:", event);
            return {};
          };
        `),
        role: lambdaRole,
        logRetention: RetentionDays.ONE_MONTH,
        memorySize: 1024,
        timeout: Duration.minutes(15),
      },
    );

  }
}
