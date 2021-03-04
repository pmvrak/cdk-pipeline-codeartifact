#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkPipelineCodeartifactStack } from '../lib/cdk-pipeline-codeartifact-stack';

const app = new cdk.App();
new CdkPipelineCodeartifactStack(app, 'CdkPipelineCodeartifactStack');
