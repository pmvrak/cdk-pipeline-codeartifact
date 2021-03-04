import * as cdk from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as pipelines from '@aws-cdk/pipelines';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as iam from '@aws-cdk/aws-iam';
import codeartifact = require('@aws-cdk/aws-codeartifact');



export class CdkPipelineCodeartifactStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here


    const repo = new codecommit.Repository(this, "codeartifact-pipeline-repository", {
      repositoryName: "codeartifact-pipeline-repository",
      description: "codeartifact-pipeline-repository"
    });    
  
    const buildRole = new iam.Role(this, 'JarBuild_CodeArtifact_Role', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    });
    
    buildRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: ['*'],
    }));


    // CODEBUILD - project
    const project = new codebuild.Project(this, 'JarBuild_CodeArtifact', {
      projectName: 'JarBuild_CodeArtifact',
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_2,
        privileged: true
      },
      role: buildRole,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              'pip install --upgrade pip',
              'pip install awscli',
              'pip install requests',
              'pip install boto3',
              'export CODEARTIFACT_AUTH_TOKEN=`aws codeartifact get-authorization-token --domain cdkpipelines-codeartifact --domain-owner 008732538448 --query authorizationToken --output text`',
            ],
          },
          build: {
            commands: [
              'cp settings.xml /root/.m2/settings.xml',
              'cp pom.xml /root/.m2/pom.xml',
              'echo "Delete previous Artifact Versions from CodeArtifact"',
              'aws codeartifact delete-package-versions --domain cdkpipelines-codeartifact --domain-owner 008732538448 --repository cdkpipelines-codeartifact-repository --namespace JavaEvents --format maven --package JavaEvents --versions snapshot',
              'mvn -f pom.xml compile',
              'mvn -s settings.xml clean deploy',
            ],
          },
          post_build: {
            commands: [
              'bash -c "if [ /"$CODEBUILD_BUILD_SUCCEEDING/" == /"0/" ]; then exit 1; fi"',
              'echo Build completed on `date`',
            ]
          }
        },
        artifacts: {
          files: [
            '*',
          ],
        },
        cache: {
          paths: [
            "'/root/.m2/**/*'.",
          ],
        },
      })
    });


        // CODEBUILD - project
        const deployproject = new codebuild.Project(this, 'JarDeploy_Lambda', {
          projectName: 'JarDeploy_Lambda',
          role: buildRole,
          environment: {
            buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_2,
            privileged: true
          },
          buildSpec: codebuild.BuildSpec.fromObject({
            version: "0.2",
            phases: {
              pre_build: {
                commands: [
                  'aws codeartifact list-packages \
                  --domain cdkpipelines-codeartifact \
                  --repository cdkpipelines-codeartifact-repository',
                ]
              },
              build: {
                commands: [
                  'echo "Lambda Deploy Stage"',
                  'aws codeartifact get-package-version-asset --domain cdkpipelines-codeartifact --repository cdkpipelines-codeartifact-repository --format maven --package JavaEvents --package-version snapshot --namespace JavaEvents --asset JavaEvents-snapshot.jar demooutput',
                  'ls -tlrh',
                ]
              },
              post_build: {
                commands: [
                  'bash -c "if [ /"$CODEBUILD_BUILD_SUCCEEDING/" == /"0/" ]; then exit 1; fi"',
                  'aws lambda update-function-code --function-name codeartifact-test-function --zip-file fileb://demooutput'
                ]
              }
            },
          })
        });
    

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();
    const deployOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'Source_CodeCommit',
      repository: repo,
      branch: 'main',
      output: sourceOutput
    });

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: project,
      input: sourceOutput,
      outputs: [buildOutput], 
    });

    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Approve',
    });

    const deployAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: deployproject,
      input: buildOutput,
      outputs: [deployOutput], 
    });

    new codepipeline.Pipeline(this, 'codeartifact-pipeline', {
      stages: [
        {
          stageName: 'Source_CodeCommit',
          actions: [sourceAction],
        },
        {
          stageName: 'Build_JAR_CodeArtifact',
          actions: [buildAction],
        },
        {
          stageName: 'Manual_Approval',
          actions: [manualApprovalAction],
        },
        {
          stageName: 'Deploy-to-Lambda',
          actions: [deployAction],
        }
      ]
    });





  }
}
