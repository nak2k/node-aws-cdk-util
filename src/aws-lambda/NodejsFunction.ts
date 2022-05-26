import type { IPrincipal, IRole } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function, FunctionBase, FunctionProps, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct, Node } from 'constructs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NodejsLayerVersion, NodejsLayerVersionProps } from './NodejsLayerVersion';

export interface NodejsFunctionProps extends Partial<FunctionProps>, Omit<NodejsLayerVersionProps, 'providerOnly'> {
}

/**
 * The construct defines a Lambda Function and a Lambda Layer for NodeJS.
 * 
 * This construct requires package.json in a specified directory.
 * To generate a Code asset, the directory that is specified
 * with the `main` property of the package.json is used.
 */
export class NodejsFunction extends FunctionBase {
  readonly handler: Function;
  readonly nodejsLayerVersion: NodejsLayerVersion;

  get layerVersion() {
    return this.nodejsLayerVersion.layerVersion;
  }

  readonly grantPrincipal: IPrincipal;
  readonly functionName: string;
  readonly functionArn: string;
  readonly role?: IRole;
  readonly permissionsNode: Node;
  readonly architecture: Architecture;
  protected readonly canCreatePermissions: boolean;
  readonly resourceArnsForGrantInvoke: string[];

  constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
    super(scope, id);

    const {
      packageDirectory,
      useLockFile,
      npmArgs,
      code,
      runtime,
      handler,
      layers,
      ...restProps
    } = props;

    this.nodejsLayerVersion = new NodejsLayerVersion(this, 'LayerVersion', {
      packageDirectory,
      useLockFile,
      npmArgs,
    });

    this.handler = new Function(this, 'Function', {
      code: code || NodejsFunction.getCode(packageDirectory),
      runtime: runtime || Runtime.NODEJS_16_X,
      handler: handler || 'index.handler',
      layers: layers ? [...layers, this.layerVersion] : [this.layerVersion],
      ...restProps
    });

    this.grantPrincipal = this.handler.grantPrincipal;
    this.functionName = this.handler.functionName;
    this.functionArn = this.handler.functionArn;
    this.role = this.handler.role;
    this.permissionsNode = this.handler.permissionsNode;
    this.architecture = this.handler.architecture;
    this.canCreatePermissions = true;
    this.resourceArnsForGrantInvoke = this.handler.resourceArnsForGrantInvoke;
  }

  public static getCode(packageDirectory: string) {
    const pkg = readFileSync(join(packageDirectory, 'package.json'), 'utf8');
    const { main } = JSON.parse(pkg);

    return Code.fromAsset(main ? join(packageDirectory, main) : packageDirectory);
  }
}
