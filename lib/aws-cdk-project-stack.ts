import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class AwsCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a unique bucket name using account ID, region, and date-time
    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // Generate the current date and time
    const now = new Date();
    const dateString = now.toISOString().replace(/[:\-]/g, '').replace(/\..+/, '');

    // Define the S3 bucket with a unique name
    new s3.Bucket(this, 'MyBucket', {
      bucketName: `my-unique-bucket-${account}-${region}-${dateString}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete the bucket when the stack is deleted
      autoDeleteObjects: true, // Automatically delete all objects in the bucket when the stack is deleted
    });

    // Define another S3 bucket with a unique name
    new s3.Bucket(this, 'MyBucket2', {
      bucketName: `test-github-action-${account}-${region}-${dateString}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete the bucket when the stack is deleted
      autoDeleteObjects: true, // Automatically delete all objects in the bucket when the stack is deleted
    });
  }
}
