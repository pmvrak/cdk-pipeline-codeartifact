"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkPipelineCodeartifactStack = void 0;
const cdk = require("@aws-cdk/core");
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
const codecommit = require("@aws-cdk/aws-codecommit");
const codebuild = require("@aws-cdk/aws-codebuild");
const iam = require("@aws-cdk/aws-iam");
class CdkPipelineCodeartifactStack extends cdk.Stack {
    constructor(scope, id, props) {
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
                            /*
                                NOTE : Please COMMENT the below two lines, when you are running the pipeline for the FIRST TIME as the package will not be there
                                to delete teh FIRST TIME.
                        
                                NOTE: Please UN-COMMENT the below two lines in subsequent runs !!
                            */
                            //       'echo "Delete previous Artifact Versions from CodeArtifact"',
                            //       'aws codeartifact delete-package-versions --domain cdkpipelines-codeartifact --domain-owner 008732538448 --repository cdkpipelines-codeartifact-repository --namespace JavaEvents --format maven --package JavaEvents --versions snapshot',
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
exports.CdkPipelineCodeartifactStack = CdkPipelineCodeartifactStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLXBpcGVsaW5lLWNvZGVhcnRpZmFjdC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1waXBlbGluZS1jb2RlYXJ0aWZhY3Qtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBQ3JDLDBEQUEwRDtBQUMxRCwwRUFBMEU7QUFFMUUsc0RBQXNEO0FBQ3RELG9EQUFvRDtBQUNwRCx3Q0FBd0M7QUFLeEMsTUFBYSw0QkFBNkIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN6RCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDZDQUE2QztRQUc3QyxNQUFNLElBQUksR0FBRyxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLGtDQUFrQyxFQUFFO1lBQy9FLGNBQWMsRUFBRSxrQ0FBa0M7WUFDbEQsV0FBVyxFQUFFLGtDQUFrQztTQUNoRCxDQUFDLENBQUM7UUFFSCxNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ2pFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx5QkFBeUIsQ0FBQztTQUMvRCxDQUFDLENBQUM7UUFFSCxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUM1QyxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNoQixPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDZixDQUFDLENBQUMsQ0FBQztRQUdKLHNCQUFzQjtRQUN0QixNQUFNLE9BQU8sR0FBRyxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ25FLFdBQVcsRUFB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LENBQUM7WUFDNUQsVUFBVSxFQUFFLFdBQVc7WUFDdkIsT0FBTyxFQUFFLGFBQWE7WUFDdEIsS0FBSyxFQUFFLFdBQVc7WUFDbEIsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDO1NBQ3hCLENBQUMsQ0FBQztRQUVILElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDdkQsTUFBTSxFQUFFO2dCQUNOO29CQUNFLFNBQVMsRUFBRSxtQkFBbUI7b0JBQzlCLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQztpQkFDeEI7Z0JBQ0Q7b0JBQ0UsU0FBUyxFQUFFLHdCQUF3QjtvQkFDbkMsT0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDO2lCQUN2QjtnQkFDRDtvQkFDRSxTQUFTLEVBQUUsaUJBQWlCO29CQUM1QixPQUFPLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztpQkFDaEM7Z0JBQ0Q7b0JBQ0UsU0FBUyxFQUFFLGtCQUFrQjtvQkFDN0IsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDO2lCQUN4QjthQUNGO1NBQ0YsQ0FBQyxDQUFDO0lBTUwsQ0FBQztDQUNGO0FBM0tELG9FQTJLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZSBmcm9tICdAYXdzLWNkay9hd3MtY29kZXBpcGVsaW5lJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZV9hY3Rpb25zIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBwaXBlbGluZXMgZnJvbSAnQGF3cy1jZGsvcGlwZWxpbmVzJztcbmltcG9ydCAqIGFzIGNvZGVjb21taXQgZnJvbSAnQGF3cy1jZGsvYXdzLWNvZGVjb21taXQnO1xuaW1wb3J0ICogYXMgY29kZWJ1aWxkIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlYnVpbGQnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ0Bhd3MtY2RrL2F3cy1pYW0nO1xuaW1wb3J0IGNvZGVhcnRpZmFjdCA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1jb2RlYXJ0aWZhY3QnKTtcblxuXG5cbmV4cG9ydCBjbGFzcyBDZGtQaXBlbGluZUNvZGVhcnRpZmFjdFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFRoZSBjb2RlIHRoYXQgZGVmaW5lcyB5b3VyIHN0YWNrIGdvZXMgaGVyZVxuXG5cbiAgICBjb25zdCByZXBvID0gbmV3IGNvZGVjb21taXQuUmVwb3NpdG9yeSh0aGlzLCBcImNvZGVhcnRpZmFjdC1waXBlbGluZS1yZXBvc2l0b3J5XCIsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiBcImNvZGVhcnRpZmFjdC1waXBlbGluZS1yZXBvc2l0b3J5XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJjb2RlYXJ0aWZhY3QtcGlwZWxpbmUtcmVwb3NpdG9yeVwiXG4gICAgfSk7ICAgIFxuICBcbiAgICBjb25zdCBidWlsZFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0phckJ1aWxkX0NvZGVBcnRpZmFjdF9Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2NvZGVidWlsZC5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG4gICAgXG4gICAgYnVpbGRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICBhY3Rpb25zOiBbJyonXSxcbiAgICB9KSk7XG5cblxuICAgIC8vIENPREVCVUlMRCAtIHByb2plY3RcbiAgICBjb25zdCBwcm9qZWN0ID0gbmV3IGNvZGVidWlsZC5Qcm9qZWN0KHRoaXMsICdKYXJCdWlsZF9Db2RlQXJ0aWZhY3QnLCB7XG4gICAgICBwcm9qZWN0TmFtZTogJ0phckJ1aWxkX0NvZGVBcnRpZmFjdCcsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBidWlsZEltYWdlOiBjb2RlYnVpbGQuTGludXhCdWlsZEltYWdlLkFNQVpPTl9MSU5VWF8yXzIsXG4gICAgICAgIHByaXZpbGVnZWQ6IHRydWVcbiAgICAgIH0sXG4gICAgICByb2xlOiBidWlsZFJvbGUsXG4gICAgICBidWlsZFNwZWM6IGNvZGVidWlsZC5CdWlsZFNwZWMuZnJvbU9iamVjdCh7XG4gICAgICAgIHZlcnNpb246IFwiMC4yXCIsXG4gICAgICAgIHBoYXNlczoge1xuICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ3BpcCBpbnN0YWxsIC0tdXBncmFkZSBwaXAnLFxuICAgICAgICAgICAgICAncGlwIGluc3RhbGwgYXdzY2xpJyxcbiAgICAgICAgICAgICAgJ3BpcCBpbnN0YWxsIHJlcXVlc3RzJyxcbiAgICAgICAgICAgICAgJ3BpcCBpbnN0YWxsIGJvdG8zJyxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBDT0RFQVJUSUZBQ1RfQVVUSF9UT0tFTj1gYXdzIGNvZGVhcnRpZmFjdCBnZXQtYXV0aG9yaXphdGlvbi10b2tlbiAtLWRvbWFpbiBjZGtwaXBlbGluZXMtY29kZWFydGlmYWN0IC0tZG9tYWluLW93bmVyIDAwODczMjUzODQ0OCAtLXF1ZXJ5IGF1dGhvcml6YXRpb25Ub2tlbiAtLW91dHB1dCB0ZXh0YCcsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdjcCBzZXR0aW5ncy54bWwgL3Jvb3QvLm0yL3NldHRpbmdzLnhtbCcsXG4gICAgICAgICAgICAgICdjcCBwb20ueG1sIC9yb290Ly5tMi9wb20ueG1sJyxcbiAgICAvKlxuICAgICAgICBOT1RFIDogUGxlYXNlIENPTU1FTlQgdGhlIGJlbG93IHR3byBsaW5lcywgd2hlbiB5b3UgYXJlIHJ1bm5pbmcgdGhlIHBpcGVsaW5lIGZvciB0aGUgRklSU1QgVElNRSBhcyB0aGUgcGFja2FnZSB3aWxsIG5vdCBiZSB0aGVyZSBcbiAgICAgICAgdG8gZGVsZXRlIHRlaCBGSVJTVCBUSU1FLlxuXG4gICAgICAgIE5PVEU6IFBsZWFzZSBVTi1DT01NRU5UIHRoZSBiZWxvdyB0d28gbGluZXMgaW4gc3Vic2VxdWVudCBydW5zICEhXG4gICAgKi9cbiAgICAgICAvLyAgICAgICAnZWNobyBcIkRlbGV0ZSBwcmV2aW91cyBBcnRpZmFjdCBWZXJzaW9ucyBmcm9tIENvZGVBcnRpZmFjdFwiJyxcbiAgICAgICAvLyAgICAgICAnYXdzIGNvZGVhcnRpZmFjdCBkZWxldGUtcGFja2FnZS12ZXJzaW9ucyAtLWRvbWFpbiBjZGtwaXBlbGluZXMtY29kZWFydGlmYWN0IC0tZG9tYWluLW93bmVyIDAwODczMjUzODQ0OCAtLXJlcG9zaXRvcnkgY2RrcGlwZWxpbmVzLWNvZGVhcnRpZmFjdC1yZXBvc2l0b3J5IC0tbmFtZXNwYWNlIEphdmFFdmVudHMgLS1mb3JtYXQgbWF2ZW4gLS1wYWNrYWdlIEphdmFFdmVudHMgLS12ZXJzaW9ucyBzbmFwc2hvdCcsXG4gICAgICAgICAgICAgICdtdm4gLWYgcG9tLnhtbCBjb21waWxlJyxcbiAgICAgICAgICAgICAgJ212biAtcyBzZXR0aW5ncy54bWwgY2xlYW4gZGVwbG95JyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwb3N0X2J1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnYmFzaCAtYyBcImlmIFsgL1wiJENPREVCVUlMRF9CVUlMRF9TVUNDRUVESU5HL1wiID09IC9cIjAvXCIgXTsgdGhlbiBleGl0IDE7IGZpXCInLFxuICAgICAgICAgICAgICAnZWNobyBCdWlsZCBjb21wbGV0ZWQgb24gYGRhdGVgJyxcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGFydGlmYWN0czoge1xuICAgICAgICAgIGZpbGVzOiBbXG4gICAgICAgICAgICAnKicsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgY2FjaGU6IHtcbiAgICAgICAgICBwYXRoczogW1xuICAgICAgICAgICAgXCInL3Jvb3QvLm0yLyoqLyonLlwiLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgIH0pO1xuXG5cbiAgICAgICAgLy8gQ09ERUJVSUxEIC0gcHJvamVjdFxuICAgICAgICBjb25zdCBkZXBsb3lwcm9qZWN0ID0gbmV3IGNvZGVidWlsZC5Qcm9qZWN0KHRoaXMsICdKYXJEZXBsb3lfTGFtYmRhJywge1xuICAgICAgICAgIHByb2plY3ROYW1lOiAnSmFyRGVwbG95X0xhbWJkYScsXG4gICAgICAgICAgcm9sZTogYnVpbGRSb2xlLFxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBidWlsZEltYWdlOiBjb2RlYnVpbGQuTGludXhCdWlsZEltYWdlLkFNQVpPTl9MSU5VWF8yXzIsXG4gICAgICAgICAgICBwcml2aWxlZ2VkOiB0cnVlXG4gICAgICAgICAgfSxcbiAgICAgICAgICBidWlsZFNwZWM6IGNvZGVidWlsZC5CdWlsZFNwZWMuZnJvbU9iamVjdCh7XG4gICAgICAgICAgICB2ZXJzaW9uOiBcIjAuMlwiLFxuICAgICAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICAgICAnYXdzIGNvZGVhcnRpZmFjdCBsaXN0LXBhY2thZ2VzIFxcXG4gICAgICAgICAgICAgICAgICAtLWRvbWFpbiBjZGtwaXBlbGluZXMtY29kZWFydGlmYWN0IFxcXG4gICAgICAgICAgICAgICAgICAtLXJlcG9zaXRvcnkgY2RrcGlwZWxpbmVzLWNvZGVhcnRpZmFjdC1yZXBvc2l0b3J5JyxcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgICAgICdlY2hvIFwiTGFtYmRhIERlcGxveSBTdGFnZVwiJyxcbiAgICAgICAgICAgICAgICAgICdhd3MgY29kZWFydGlmYWN0IGdldC1wYWNrYWdlLXZlcnNpb24tYXNzZXQgLS1kb21haW4gY2RrcGlwZWxpbmVzLWNvZGVhcnRpZmFjdCAtLXJlcG9zaXRvcnkgY2RrcGlwZWxpbmVzLWNvZGVhcnRpZmFjdC1yZXBvc2l0b3J5IC0tZm9ybWF0IG1hdmVuIC0tcGFja2FnZSBKYXZhRXZlbnRzIC0tcGFja2FnZS12ZXJzaW9uIHNuYXBzaG90IC0tbmFtZXNwYWNlIEphdmFFdmVudHMgLS1hc3NldCBKYXZhRXZlbnRzLXNuYXBzaG90LmphciBkZW1vb3V0cHV0JyxcbiAgICAgICAgICAgICAgICAgICdscyAtdGxyaCcsXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBwb3N0X2J1aWxkOiB7XG4gICAgICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgICAgICdiYXNoIC1jIFwiaWYgWyAvXCIkQ09ERUJVSUxEX0JVSUxEX1NVQ0NFRURJTkcvXCIgPT0gL1wiMC9cIiBdOyB0aGVuIGV4aXQgMTsgZmlcIicsXG4gICAgICAgICAgICAgICAgICAnYXdzIGxhbWJkYSB1cGRhdGUtZnVuY3Rpb24tY29kZSAtLWZ1bmN0aW9uLW5hbWUgY29kZWFydGlmYWN0LXRlc3QtZnVuY3Rpb24gLS16aXAtZmlsZSBmaWxlYjovL2RlbW9vdXRwdXQnXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuICAgIFxuXG4gICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgpO1xuICAgIGNvbnN0IGJ1aWxkT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgpO1xuICAgIGNvbnN0IGRlcGxveU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcblxuICAgIGNvbnN0IHNvdXJjZUFjdGlvbiA9IG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQ29tbWl0U291cmNlQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6ICdTb3VyY2VfQ29kZUNvbW1pdCcsXG4gICAgICByZXBvc2l0b3J5OiByZXBvLFxuICAgICAgYnJhbmNoOiAnbWFpbicsXG4gICAgICBvdXRwdXQ6IHNvdXJjZU91dHB1dFxuICAgIH0pO1xuXG4gICAgY29uc3QgYnVpbGRBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6ICdDb2RlQnVpbGQnLFxuICAgICAgcHJvamVjdDogcHJvamVjdCxcbiAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICBvdXRwdXRzOiBbYnVpbGRPdXRwdXRdLCBcbiAgICB9KTtcblxuICAgIGNvbnN0IG1hbnVhbEFwcHJvdmFsQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLk1hbnVhbEFwcHJvdmFsQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6ICdBcHByb3ZlJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRlcGxveUFjdGlvbiA9IG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ0NvZGVCdWlsZCcsXG4gICAgICBwcm9qZWN0OiBkZXBsb3lwcm9qZWN0LFxuICAgICAgaW5wdXQ6IGJ1aWxkT3V0cHV0LFxuICAgICAgb3V0cHV0czogW2RlcGxveU91dHB1dF0sIFxuICAgIH0pO1xuXG4gICAgbmV3IGNvZGVwaXBlbGluZS5QaXBlbGluZSh0aGlzLCAnY29kZWFydGlmYWN0LXBpcGVsaW5lJywge1xuICAgICAgc3RhZ2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGFnZU5hbWU6ICdTb3VyY2VfQ29kZUNvbW1pdCcsXG4gICAgICAgICAgYWN0aW9uczogW3NvdXJjZUFjdGlvbl0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzdGFnZU5hbWU6ICdCdWlsZF9KQVJfQ29kZUFydGlmYWN0JyxcbiAgICAgICAgICBhY3Rpb25zOiBbYnVpbGRBY3Rpb25dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnTWFudWFsX0FwcHJvdmFsJyxcbiAgICAgICAgICBhY3Rpb25zOiBbbWFudWFsQXBwcm92YWxBY3Rpb25dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnRGVwbG95LXRvLUxhbWJkYScsXG4gICAgICAgICAgYWN0aW9uczogW2RlcGxveUFjdGlvbl0sXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcblxuXG5cblxuXG4gIH1cbn1cbiJdfQ==