import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: 'liveness-store', // logical name; Amplify will generate the actual bucket
})