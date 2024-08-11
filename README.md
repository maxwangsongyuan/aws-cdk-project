# A CDK project that notifies users about their LeetCode progress via email. Utilized Github Action to create an automated deployment pipeline

This is a sample email you will receive:
![Screenshot 2024-08-11 at 3 22 14 PM](https://github.com/user-attachments/assets/2c69aca1-a9fa-425d-97b2-8758556753d8)

This is the design diagram:
<img width="1043" alt="Screenshot 2024-08-11 at 3 43 35 PM" src="https://github.com/user-attachments/assets/585e50e7-6075-48c6-af90-2db9642bc9ad">

This shows the design works correctly:
![Screenshot 2024-08-11 at 3 49 20 PM](https://github.com/user-attachments/assets/5b55158f-4139-47b4-a3d7-26c5fd1d594a)

---

Must-Dos before running the project (search for TODO in the code):

1. Create a Lambda Layer from the ZIP file in S3, which includes the requests library
. This is done manually by uploading the ZIP file to a S3 bucket  :  [requests_layer.zip](https://github.com/user-attachments/files/16576243/requests_layer.zip)
![Screenshot 2024-08-11 at 2 27 27 PM](https://github.com/user-attachments/assets/0d26289e-999b-438c-9097-86e79f60016e)
2. In deploy.yml, you will see ${{ secrets.AWS_ACCESS_KEY_ID_GAMMA }}, ${{ secrets.AWS_SECRET_ACCESS_KEY_GAMMA }}. these secrets need to be added to the GitHub repository. Go to repository settings -> secrets and variables (left panel) -> action -> new repository secret
![Screenshot 2024-08-11 at 12 36 39 PM](https://github.com/user-attachments/assets/90d19f2e-28dc-4aca-9081-4d9da615137d)
![Screenshot 2024-08-11 at 12 36 52 PM](https://github.com/user-attachments/assets/81f2cab9-36d1-4511-bce7-937cb185b172)
3. Replace with your SES-verified email and destination email. Go to AWS console, go to SES service, on the left panel,
   click on identities under Configuration, and create a new identity
![Screenshot 2024-08-11 at 2 29 36 PM](https://github.com/user-attachments/assets/661acd57-cd8f-44b0-beb2-561307da2764)

Note: This is currently automatically deployed to 2 regions: us-west-2. You can uncomment the deploy.yaml to deploy to more prod stages/regions

---

## How to get started:
* `aws configure`   set up aws account connection -> in ChatGPT, search "how to set up aws configure" . if you don't have the AWS Access Key ID and Secret Access Key, search "AWS Access Key ID and Secret Access Key"
```
$ aws configure
AWS Access Key ID [None]: yourID
AWS Secret Access Key [None]: yourKey
Default region name [None]: us-west-2
Default output format [None]: json
```
* `npm run build`   compile typescript to js
* `cdk bootstrap`   If this is your first time using AWS resources, you need to run cdk bootstrap once before running cdk deploy,
* `cdk deploy`      This is an optional step as you can run below git commands. deploy this stack to your default AWS account/region
* `git add .`
* `git commit -m "new code"`
* `git push`

---

## Useful commands
* `aws configure`   set up aws account connection
* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk bootstrap`   before running cdk deploy, you need to run cdk bootstrap once when deploying to a new region
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

