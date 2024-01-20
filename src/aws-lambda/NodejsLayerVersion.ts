import { CustomResource, Duration, Stack } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, Project } from 'aws-cdk-lib/aws-codebuild';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Function, ILayerVersion, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from "constructs";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';

export interface NodejsLayerVersionProps {
  /**
   * The path of the directory that contains package.json and package-lock.json.
   */
  packageDirectory: string;

  /**
   * The boolean value whether use package-lock.json instead of package.json.
   */
  useLockFile?: boolean;

  /**
   * Arguments that pass to npm.
   * 
   * @default if useLockFile enabled, ['ci', '--production'], otherwise ['install', '--production'].
   */
  npmArgs?: ReadonlyArray<string>;

  /**
   * The boolean value whether only the custom resource provider is deployed for debugging.
   */
  providerOnly?: boolean;

  /**
   * The boolean value whether delete old layer versions.
   */
  deleteLayer?: boolean;
}

/**
 * The Lambda Layer version for NodeJS.
 * 
 * Contents of the Lambda layer are generated by running `npm install` in CodeBuild.
 * There is no need to prepare the contents before running the CDK.
 */
export class NodejsLayerVersion extends Construct {
  public static readonly resourceType = 'Custom::NodejsLayerVersion';

  private _layerVersion: ILayerVersion;

  public get layerVersion(): ILayerVersion {
    if (this.props.providerOnly) {
      throw new Error('The providerOnly option is enabled, so LayerVersion is not created');
    }

    return this._layerVersion;
  }

  constructor(scope: Construct, id: string, private props: NodejsLayerVersionProps) {
    super(scope, id);

    const { packageDirectory, useLockFile, npmArgs, providerOnly, deleteLayer } = props;

    const asset = this.createAsset(packageDirectory);

    const serviceToken = this.createProvider(scope);

    if (providerOnly) {
      return;
    }

    const resource = new CustomResource(this, 'CustomResource', {
      resourceType: NodejsLayerVersion.resourceType,
      serviceToken,
      properties: {
        Package: {
          Bucket: asset.s3BucketName,
          Key: asset.s3ObjectKey,
        },
        NpmArgs: npmArgs || (
          useLockFile ? ['ci', '--production'] : ['install', '--production']
        ),
        DeleteLayer: deleteLayer,
      },
    });

    this._layerVersion = LayerVersion.fromLayerVersionArn(this, 'LayerVersion', resource.ref);
  }

  private createProvider(scope: Construct) {
    const providerId = `${NodejsLayerVersion.resourceType}Provider`;
    const stack = Stack.of(scope);

    const builder = this.createBuilder(scope);

    const provider = stack.node.tryFindChild(providerId) as Function
      ?? new Function(stack, providerId, {
        code: Code.fromAsset(join(__dirname, 'nodejslayer-handler')),
        runtime: Runtime.NODEJS_20_X,
        handler: "index.handler",
        environment: {
          BUILDER_NAME: builder.projectName,
        },
        initialPolicy: [
          new PolicyStatement({
            actions: [
              'codebuild:BatchGetBuilds',
              'codebuild:StartBuild',
              'lambda:DeleteLayerVersion',
              's3:GetObject*',
              's3:PutObject*',
            ],
            resources: ['*'],
          }),
        ],
        timeout: Duration.minutes(15),
        retryAttempts: 1,
      });

    return provider.functionArn;
  }

  private createBuilder(scope: Construct) {
    const builderId = `${NodejsLayerVersion.resourceType}Builder`;
    const stack = Stack.of(scope);

    const singleton = stack.node.tryFindChild(builderId) as Project;
    if (singleton) {
      return singleton;
    }

    const builder = new Project(stack, builderId, {
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
      },
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'echo "This project must not be started directly."',
              "false",
            ],
          },
        },
      }),
      timeout: Duration.minutes(14),
    });

    builder.addToRolePolicy(new PolicyStatement({
      actions: [
        'lambda:PublishLayerVersion',
        's3:GetObject*',
        's3:PutObject*',
      ],
      resources: ['*'],
    }));

    return builder;
  }

  private createAsset(packageDirectory: string) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cdk-util-aws-lambda-'));
    const pkgJsonPath = join(tmpDir, 'package.json');
    const pkgLockJsonPath = join(tmpDir, 'package-lock.json');

    copyFileSync(join(packageDirectory, 'package.json'), pkgJsonPath);
    copyFileSync(join(packageDirectory, 'package-lock.json'), pkgLockJsonPath);

    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    const { dependencies, devDependencies } = pkg;
    let modified = false;

    if (dependencies) {
      processDependencies(dependencies);
    }

    if (devDependencies) {
      processDependencies(devDependencies);
    }

    if (modified) {
      writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
    }

    return new Asset(this, 'asset', {
      path: tmpDir,
    });

    function processDependencies(dependencies: { [name: string]: string }) {
      Object.entries(dependencies).forEach(([name, value]) => {
        if (!value.startsWith("file:")) {
          return;
        }

        if (!value.endsWith(".tgz")) {
          throw new Error(`The local path ${value} is not a path to tarball, not supported yet`);
        }

        const tarballPath = value.substr(5);
        const tarballBasename = basename(tarballPath);
        copyFileSync(join(packageDirectory, tarballPath), join(tmpDir, tarballBasename));

        dependencies[name] = `file:${tarballBasename}`;

        modified = true;
      });
    }
  }
}
