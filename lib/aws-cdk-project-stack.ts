import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class AwsCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define the S3 bucket
    new s3.Bucket(this, 'MyBucket', {
      bucketName: 'my-unique-bucket-name-864899851256',
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete the bucket when the stack is deleted
      autoDeleteObjects: true, // Automatically delete all objects in the bucket when the stack is deleted
    });
  }
}
