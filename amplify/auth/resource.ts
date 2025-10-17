import { defineAuth } from '@aws-amplify/backend';
export const auth = defineAuth({ loginWith: { email: true } }); // no UI needed; we just want the Identity Pool
