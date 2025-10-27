// lib/amplifyClient.ts
'use client';
import { Amplify } from 'aws-amplify';
import outputs from '@/../amplify_outputs.json';
import dotenv from "dotenv";
dotenv.config();
let configured = false;
export function ensureAmplifyConfigured() {
  if (!configured) { Amplify.configure(outputs); configured = true; }
}
