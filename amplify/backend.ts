// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { storage } from './storage/resource';

const backend = defineBackend({ auth, storage });

// Give both unauth/auth roles permission to start the liveness stream from the browser
const stack = backend.createStack('liveness-stack');
const policy = new Policy(stack, 'LivenessPolicy', {
  statements: [
    new PolicyStatement({
      actions: ['rekognition:StartFaceLivenessSession'],
      resources: ['*'],
    }),
  ],
});
backend.auth.resources.unauthenticatedUserIamRole.attachInlinePolicy(policy);
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(policy);
export default backend;
