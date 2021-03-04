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
exports.CdkPipelineCodeartifactStack = CdkPipelineCodeartifactStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLXBpcGVsaW5lLWNvZGVhcnRpZmFjdC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1waXBlbGluZS1jb2RlYXJ0aWZhY3Qtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBQ3JDLDBEQUEwRDtBQUMxRCwwRUFBMEU7QUFFMUUsc0RBQXNEO0FBQ3RELG9EQUFvRDtBQUNwRCx3Q0FBd0M7QUFLeEMsTUFBYSw0QkFBNkIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN6RCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDZDQUE2QztRQUc3QyxNQUFNLElBQUksR0FBRyxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLGtDQUFrQyxFQUFFO1lBQy9FLGNBQWMsRUFBRSxrQ0FBa0M7WUFDbEQsV0FBVyxFQUFFLGtDQUFrQztTQUNoRCxDQUFDLENBQUM7UUFFSCxNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ2pFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx5QkFBeUIsQ0FBQztTQUMvRCxDQUFDLENBQUM7UUFFSCxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUM1QyxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNoQixPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDZixDQUFDLENBQUMsQ0FBQztRQUdKLHNCQUFzQjtRQUN0QixNQUFNLE9BQU8sR0FBRyxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ25FLFdBQVcsRUFB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LEVBQUUsV0FBVztZQUN2QixPQUFPLEVBQUUsYUFBYTtZQUN0QixLQUFLLEVBQUUsV0FBVztZQUNsQixPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUM7U0FDeEIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUN2RCxNQUFNLEVBQUU7Z0JBQ047b0JBQ0UsU0FBUyxFQUFFLG1CQUFtQjtvQkFDOUIsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDO2lCQUN4QjtnQkFDRDtvQkFDRSxTQUFTLEVBQUUsd0JBQXdCO29CQUNuQyxPQUFPLEVBQUUsQ0FBQyxXQUFXLENBQUM7aUJBQ3ZCO2dCQUNEO29CQUNFLFNBQVMsRUFBRSxpQkFBaUI7b0JBQzVCLE9BQU8sRUFBRSxDQUFDLG9CQUFvQixDQUFDO2lCQUNoQztnQkFDRDtvQkFDRSxTQUFTLEVBQUUsa0JBQWtCO29CQUM3QixPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUM7aUJBQ3hCO2FBQ0Y7U0FDRixDQUFDLENBQUM7SUFNTCxDQUFDO0NBQ0Y7QUFyS0Qsb0VBcUtDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0ICogYXMgY29kZXBpcGVsaW5lIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUnO1xuaW1wb3J0ICogYXMgY29kZXBpcGVsaW5lX2FjdGlvbnMgZnJvbSAnQGF3cy1jZGsvYXdzLWNvZGVwaXBlbGluZS1hY3Rpb25zJztcbmltcG9ydCAqIGFzIHBpcGVsaW5lcyBmcm9tICdAYXdzLWNkay9waXBlbGluZXMnO1xuaW1wb3J0ICogYXMgY29kZWNvbW1pdCBmcm9tICdAYXdzLWNkay9hd3MtY29kZWNvbW1pdCc7XG5pbXBvcnQgKiBhcyBjb2RlYnVpbGQgZnJvbSAnQGF3cy1jZGsvYXdzLWNvZGVidWlsZCc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgY29kZWFydGlmYWN0ID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWNvZGVhcnRpZmFjdCcpO1xuXG5cblxuZXhwb3J0IGNsYXNzIENka1BpcGVsaW5lQ29kZWFydGlmYWN0U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gVGhlIGNvZGUgdGhhdCBkZWZpbmVzIHlvdXIgc3RhY2sgZ29lcyBoZXJlXG5cblxuICAgIGNvbnN0IHJlcG8gPSBuZXcgY29kZWNvbW1pdC5SZXBvc2l0b3J5KHRoaXMsIFwiY29kZWFydGlmYWN0LXBpcGVsaW5lLXJlcG9zaXRvcnlcIiwge1xuICAgICAgcmVwb3NpdG9yeU5hbWU6IFwiY29kZWFydGlmYWN0LXBpcGVsaW5lLXJlcG9zaXRvcnlcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcImNvZGVhcnRpZmFjdC1waXBlbGluZS1yZXBvc2l0b3J5XCJcbiAgICB9KTsgICAgXG4gIFxuICAgIGNvbnN0IGJ1aWxkUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnSmFyQnVpbGRfQ29kZUFydGlmYWN0X1JvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY29kZWJ1aWxkLmFtYXpvbmF3cy5jb20nKSxcbiAgICB9KTtcbiAgICBcbiAgICBidWlsZFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIGFjdGlvbnM6IFsnKiddLFxuICAgIH0pKTtcblxuXG4gICAgLy8gQ09ERUJVSUxEIC0gcHJvamVjdFxuICAgIGNvbnN0IHByb2plY3QgPSBuZXcgY29kZWJ1aWxkLlByb2plY3QodGhpcywgJ0phckJ1aWxkX0NvZGVBcnRpZmFjdCcsIHtcbiAgICAgIHByb2plY3ROYW1lOiAnSmFyQnVpbGRfQ29kZUFydGlmYWN0JyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuQU1BWk9OX0xJTlVYXzJfMixcbiAgICAgICAgcHJpdmlsZWdlZDogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHJvbGU6IGJ1aWxkUm9sZSxcbiAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tT2JqZWN0KHtcbiAgICAgICAgdmVyc2lvbjogXCIwLjJcIixcbiAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgcHJlX2J1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAncGlwIGluc3RhbGwgLS11cGdyYWRlIHBpcCcsXG4gICAgICAgICAgICAgICdwaXAgaW5zdGFsbCBhd3NjbGknLFxuICAgICAgICAgICAgICAncGlwIGluc3RhbGwgcmVxdWVzdHMnLFxuICAgICAgICAgICAgICAncGlwIGluc3RhbGwgYm90bzMnLFxuICAgICAgICAgICAgICAnZXhwb3J0IENPREVBUlRJRkFDVF9BVVRIX1RPS0VOPWBhd3MgY29kZWFydGlmYWN0IGdldC1hdXRob3JpemF0aW9uLXRva2VuIC0tZG9tYWluIGNka3BpcGVsaW5lcy1jb2RlYXJ0aWZhY3QgLS1kb21haW4tb3duZXIgMDA4NzMyNTM4NDQ4IC0tcXVlcnkgYXV0aG9yaXphdGlvblRva2VuIC0tb3V0cHV0IHRleHRgJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2NwIHNldHRpbmdzLnhtbCAvcm9vdC8ubTIvc2V0dGluZ3MueG1sJyxcbiAgICAgICAgICAgICAgJ2NwIHBvbS54bWwgL3Jvb3QvLm0yL3BvbS54bWwnLFxuICAgICAgICAgICAgICAnZWNobyBcIkRlbGV0ZSBwcmV2aW91cyBBcnRpZmFjdCBWZXJzaW9ucyBmcm9tIENvZGVBcnRpZmFjdFwiJyxcbiAgICAgICAgICAgICAgJ2F3cyBjb2RlYXJ0aWZhY3QgZGVsZXRlLXBhY2thZ2UtdmVyc2lvbnMgLS1kb21haW4gY2RrcGlwZWxpbmVzLWNvZGVhcnRpZmFjdCAtLWRvbWFpbi1vd25lciAwMDg3MzI1Mzg0NDggLS1yZXBvc2l0b3J5IGNka3BpcGVsaW5lcy1jb2RlYXJ0aWZhY3QtcmVwb3NpdG9yeSAtLW5hbWVzcGFjZSBKYXZhRXZlbnRzIC0tZm9ybWF0IG1hdmVuIC0tcGFja2FnZSBKYXZhRXZlbnRzIC0tdmVyc2lvbnMgc25hcHNob3QnLFxuICAgICAgICAgICAgICAnbXZuIC1mIHBvbS54bWwgY29tcGlsZScsXG4gICAgICAgICAgICAgICdtdm4gLXMgc2V0dGluZ3MueG1sIGNsZWFuIGRlcGxveScsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcG9zdF9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2Jhc2ggLWMgXCJpZiBbIC9cIiRDT0RFQlVJTERfQlVJTERfU1VDQ0VFRElORy9cIiA9PSAvXCIwL1wiIF07IHRoZW4gZXhpdCAxOyBmaVwiJyxcbiAgICAgICAgICAgICAgJ2VjaG8gQnVpbGQgY29tcGxldGVkIG9uIGBkYXRlYCcsXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBhcnRpZmFjdHM6IHtcbiAgICAgICAgICBmaWxlczogW1xuICAgICAgICAgICAgJyonLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIGNhY2hlOiB7XG4gICAgICAgICAgcGF0aHM6IFtcbiAgICAgICAgICAgIFwiJy9yb290Ly5tMi8qKi8qJy5cIixcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICB9KTtcblxuXG4gICAgICAgIC8vIENPREVCVUlMRCAtIHByb2plY3RcbiAgICAgICAgY29uc3QgZGVwbG95cHJvamVjdCA9IG5ldyBjb2RlYnVpbGQuUHJvamVjdCh0aGlzLCAnSmFyRGVwbG95X0xhbWJkYScsIHtcbiAgICAgICAgICBwcm9qZWN0TmFtZTogJ0phckRlcGxveV9MYW1iZGEnLFxuICAgICAgICAgIHJvbGU6IGJ1aWxkUm9sZSxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgYnVpbGRJbWFnZTogY29kZWJ1aWxkLkxpbnV4QnVpbGRJbWFnZS5BTUFaT05fTElOVVhfMl8yLFxuICAgICAgICAgICAgcHJpdmlsZWdlZDogdHJ1ZVxuICAgICAgICAgIH0sXG4gICAgICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICAgICAgdmVyc2lvbjogXCIwLjJcIixcbiAgICAgICAgICAgIHBoYXNlczoge1xuICAgICAgICAgICAgICBwcmVfYnVpbGQ6IHtcbiAgICAgICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAgICAgJ2F3cyBjb2RlYXJ0aWZhY3QgbGlzdC1wYWNrYWdlcyBcXFxuICAgICAgICAgICAgICAgICAgLS1kb21haW4gY2RrcGlwZWxpbmVzLWNvZGVhcnRpZmFjdCBcXFxuICAgICAgICAgICAgICAgICAgLS1yZXBvc2l0b3J5IGNka3BpcGVsaW5lcy1jb2RlYXJ0aWZhY3QtcmVwb3NpdG9yeScsXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICAgICAnZWNobyBcIkxhbWJkYSBEZXBsb3kgU3RhZ2VcIicsXG4gICAgICAgICAgICAgICAgICAnYXdzIGNvZGVhcnRpZmFjdCBnZXQtcGFja2FnZS12ZXJzaW9uLWFzc2V0IC0tZG9tYWluIGNka3BpcGVsaW5lcy1jb2RlYXJ0aWZhY3QgLS1yZXBvc2l0b3J5IGNka3BpcGVsaW5lcy1jb2RlYXJ0aWZhY3QtcmVwb3NpdG9yeSAtLWZvcm1hdCBtYXZlbiAtLXBhY2thZ2UgSmF2YUV2ZW50cyAtLXBhY2thZ2UtdmVyc2lvbiBzbmFwc2hvdCAtLW5hbWVzcGFjZSBKYXZhRXZlbnRzIC0tYXNzZXQgSmF2YUV2ZW50cy1zbmFwc2hvdC5qYXIgZGVtb291dHB1dCcsXG4gICAgICAgICAgICAgICAgICAnbHMgLXRscmgnLFxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgcG9zdF9idWlsZDoge1xuICAgICAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICAgICAnYmFzaCAtYyBcImlmIFsgL1wiJENPREVCVUlMRF9CVUlMRF9TVUNDRUVESU5HL1wiID09IC9cIjAvXCIgXTsgdGhlbiBleGl0IDE7IGZpXCInLFxuICAgICAgICAgICAgICAgICAgJ2F3cyBsYW1iZGEgdXBkYXRlLWZ1bmN0aW9uLWNvZGUgLS1mdW5jdGlvbi1uYW1lIGNvZGVhcnRpZmFjdC10ZXN0LWZ1bmN0aW9uIC0temlwLWZpbGUgZmlsZWI6Ly9kZW1vb3V0cHV0J1xuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KVxuICAgICAgICB9KTtcbiAgICBcblxuICAgIGNvbnN0IHNvdXJjZU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcbiAgICBjb25zdCBidWlsZE91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcbiAgICBjb25zdCBkZXBsb3lPdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KCk7XG5cbiAgICBjb25zdCBzb3VyY2VBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUNvbW1pdFNvdXJjZUFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnU291cmNlX0NvZGVDb21taXQnLFxuICAgICAgcmVwb3NpdG9yeTogcmVwbyxcbiAgICAgIGJyYW5jaDogJ21haW4nLFxuICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXRcbiAgICB9KTtcblxuICAgIGNvbnN0IGJ1aWxkQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnQ29kZUJ1aWxkJyxcbiAgICAgIHByb2plY3Q6IHByb2plY3QsXG4gICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgb3V0cHV0czogW2J1aWxkT3V0cHV0XSwgXG4gICAgfSk7XG5cbiAgICBjb25zdCBtYW51YWxBcHByb3ZhbEFjdGlvbiA9IG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5NYW51YWxBcHByb3ZhbEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnQXBwcm92ZScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkZXBsb3lBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6ICdDb2RlQnVpbGQnLFxuICAgICAgcHJvamVjdDogZGVwbG95cHJvamVjdCxcbiAgICAgIGlucHV0OiBidWlsZE91dHB1dCxcbiAgICAgIG91dHB1dHM6IFtkZXBsb3lPdXRwdXRdLCBcbiAgICB9KTtcblxuICAgIG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgJ2NvZGVhcnRpZmFjdC1waXBlbGluZScsIHtcbiAgICAgIHN0YWdlczogW1xuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnU291cmNlX0NvZGVDb21taXQnLFxuICAgICAgICAgIGFjdGlvbnM6IFtzb3VyY2VBY3Rpb25dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnQnVpbGRfSkFSX0NvZGVBcnRpZmFjdCcsXG4gICAgICAgICAgYWN0aW9uczogW2J1aWxkQWN0aW9uXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ01hbnVhbF9BcHByb3ZhbCcsXG4gICAgICAgICAgYWN0aW9uczogW21hbnVhbEFwcHJvdmFsQWN0aW9uXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ0RlcGxveS10by1MYW1iZGEnLFxuICAgICAgICAgIGFjdGlvbnM6IFtkZXBsb3lBY3Rpb25dLFxuICAgICAgICB9XG4gICAgICBdXG4gICAgfSk7XG5cblxuXG5cblxuICB9XG59XG4iXX0=