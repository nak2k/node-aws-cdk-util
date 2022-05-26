import { RestApi, Integration, MethodOptions, AwsIntegration, IntegrationResponse, MethodResponse } from "aws-cdk-lib/aws-apigateway";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IBucket } from 'aws-cdk-lib/aws-s3';

type HttpMethod = 'HEAD' | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'ANY';

export interface RestApiBuilderProps {
  /**
   * The RestApi that resources are added to.
   */
  restApi: RestApi;

  /**
   * The default role that is used when AwsIntegration is set to RestApi.
   */
  defaultRole?: IRole;
}

export type S3IntegrationProps = {
  /**
   * The S3 bucket that API Gateway sends integration requests to.
   */
  bucket: IBucket;

  /**
   * The path to which the integration request is destination.
   * 
   * This path can include path paramters.
   * The path parameters must be defined in the path of the resource.
   * 
   * @default It will be the same as the path of the resource.
   */
  path?: string;

  /**
   * Tha IAM Role that is used when API Gateway calls S3 API.
   * 
   * @default The default role that is specified when RestApiBuilder is instanciated.
   */
  role?: IRole;

  readonly requestParameters?: {
    [dest: string]: string;
  };

  readonly requestTemplates?: {
    [contentType: string]: string;
  };
} & Omit<MethodOptions, "requestParameters" | "methodResponses">;

export class RestApiBuilder {
  private readonly restApi: RestApi;
  private readonly defaultRole?: IRole;

  constructor(props: RestApiBuilderProps) {
    this.restApi = props.restApi;
    this.defaultRole = props.defaultRole;
  }

  addRoute(path: string | readonly string[], method: HttpMethod, target?: Integration, options?: MethodOptions) {
    if (typeof path !== 'string') {
      path.forEach(path => this.addRoute(path, method, target, options));
      return;
    }

    this.restApi.root.resourceForPath(path).addMethod(method, target, options);
  }

  /**
   * Define the HEAD method and the resource for the path.
   * 
   * @param path 
   * @param target 
   * @param options 
   * @returns 
   */
  head(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "HEAD", target, options);
    return this;
  }

  /**
   * Define the GET method and the resource for the path.
   *
   * @param path 
   * @param target 
   * @param options 
   * @returns 
   */
  get(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "GET", target, options);
    return this;
  }

  /**
   * Define the POST method and the resource for the path.
   *
   * @param path 
   * @param target 
   * @param options 
   * @returns 
   */
  post(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "POST", target, options);
    return this;
  }

  /**
   * Define the PUT method and the resource for the path.
   *
   * @param path 
   * @param target 
   * @param options 
   * @returns 
   */
  put(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "PUT", target, options);
    return this;
  }

  /**
   * Define the DELETE method and the resource for the path.
   *
   * @param path 
   * @param target 
   * @param options 
   * @returns 
   */
  delete(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "DELETE", target, options);
    return this;
  }

  /**
   * Define the PATCH method and the resource for the path.
   *
   * @param path 
   * @param target 
   * @param options 
   * @returns 
   */
  patch(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "PATCH", target, options);
    return this;
  }

  /**
   * Define the OPTIONS method and the resource for the path.
   *
   * @param path 
   * @param target 
   * @param options 
   * @returns 
   */
  options(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "OPTIONS", target, options);
    return this;
  }

  /**
   * Define the ANY method and the resource for the path.
   *
   * @param path 
   * @param target 
   * @param options 
   * @returns 
   */
  any(path: string | readonly string[], target?: Integration, options?: MethodOptions) {
    this.addRoute(path, "ANY", target, options);
    return this;
  }

  /**
   * Define the GET method and the resource to invoke S3 GetObject API.
   *
   * @param path 
   * @param props 
   * @returns 
   */
  getS3Integration(path: string | readonly string[], props: S3IntegrationProps) {
    if (typeof path !== 'string') {
      path.forEach(path => this.getS3Integration(path, props));
      return this;
    }

    if (path.match(/\+}/)) {
      throw new Error(`The greedy path ${path} can not be specified in the S3 intergration`);
    }

    const {
      bucket,
      path: integrationPath = path,
      role: credentialsRole = this.defaultRole,
      requestParameters: additionalRequestParameters,
      requestTemplates,
      ...methodOptions
    } = props;

    if (!credentialsRole) {
      throw new Error("The role must be specified in the S3 intergration");
    }

    const requestParameters: { [dest: string]: string; } = {
      "integration.request.header.If-Match": "method.request.header.If-Match",
      "integration.request.header.If-Modified-Since": "method.request.header.If-Modified-Since",
      "integration.request.header.If-None-Match": "method.request.header.If-None-Match",
      "integration.request.header.If-Unmodified-Since": "method.request.header.If-Unmodified-Since",
      "integration.request.header.Range": "method.request.header.Range",
    };

    const pathParameters = path.match(/(?<=\{)[^}]+(?=\})/g) || [];
    pathParameters.forEach(name =>
      requestParameters[`integration.request.path.${name}`] = `method.request.path.${name}`
    );

    const s3pathParameters = integrationPath.match(/(?<=\{)[^}]+(?=\})/g) || [];
    for (const paramName of s3pathParameters) {
      if (!pathParameters.includes(paramName)) {
        if (!requestTemplates) {
          throw new Error(`The path parameter "${paramName}" is not exists in the path "${path}"`);
        } else {
          requestParameters[`integration.request.path.${paramName}`] = `method.request.path.${paramName}`
        }
      }
    }

    if (additionalRequestParameters) {
      Object.assign(requestParameters, additionalRequestParameters);
    }

    const normalResponseParameters = {
      'method.response.header.Accept-Ranges': 'integration.response.header.Accept-Ranges',
      'method.response.header.Cache-Control': 'integration.response.header.Cache-Control',
      'method.response.header.Content-Disposition': 'integration.response.header.Content-Disposition',
      'method.response.header.Content-Encoding': 'integration.response.header.Content-Encoding',
      'method.response.header.Content-Language': 'integration.response.header.Content-Language',
      'method.response.header.Content-Range': 'integration.response.header.Content-Range',
      'method.response.header.Content-Type': 'integration.response.header.Content-Type',
      'method.response.header.ETag': 'integration.response.header.ETag',
      'method.response.header.Expires': 'integration.response.header.Expires',
      'method.response.header.Last-Modified': 'integration.response.header.Last-Modified',
    };

    const errorResponseParameters = {
      'method.response.header.Content-Type': 'integration.response.header.Content-Type',
    };

    const integrationResponses = [
      {
        statusCode: "200",
        responseParameters: normalResponseParameters,
      }, {
        statusCode: "206",
        selectionPattern: "206",
        responseParameters: normalResponseParameters,
      }, {
        statusCode: "304",
        selectionPattern: "304",
        responseParameters: normalResponseParameters,
      }, {
        statusCode: "400",
        selectionPattern: "4\\d{2}",
        responseParameters: errorResponseParameters,
      }, {
        statusCode: "500",
        selectionPattern: "5\\d{2}",
        responseParameters: errorResponseParameters,
      },
    ];

    return this.get(path, new AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: integrationPath,
      subdomain: bucket.bucketName,
      options: {
        credentialsRole,
        requestParameters,
        requestTemplates,
        integrationResponses,
      },
    }), {
      ...methodOptions,
      requestParameters: RestApiBuilder.booleanMapForValue(requestParameters),
      methodResponses: RestApiBuilder.methodResponsesFrom(integrationResponses),
    });
  }

  /**
   * Define the PUT method and the resource to invoke S3 PutObject API.
   *
   * @param path 
   * @param props 
   * @returns 
   */
  putS3Integration(path: string | readonly string[], props: S3IntegrationProps) {
    if (typeof path !== 'string') {
      path.forEach(path => this.getS3Integration(path, props));
      return this;
    }

    if (path.match(/\+}/)) {
      throw new Error(`The greedy path ${path} can not be specified in the S3 intergration`);
    }

    const {
      bucket,
      path: integrationPath = path,
      role: credentialsRole = this.defaultRole,
      requestParameters: additionalRequestParameters = {},
      requestTemplates,
      ...methodOptions
    } = props;

    if (!credentialsRole) {
      throw new Error("The role must be specified in the S3 intergration");
    }

    const requestParameters: { [dest: string]: string; } = {
      "integration.request.header.Cache-Control": "method.request.header.Cache-Control",
      "integration.request.header.Content-Disposition": "method.request.header.Content-Disposition",
      "integration.request.header.Content-Language": "method.request.header.Content-Language",
      "integration.request.header.Expires": "method.request.header.Expires",
    };

    const pathParameters = path.match(/(?<=\{)[^}]+(?=\})/g) || [];
    pathParameters.forEach(name =>
      requestParameters[`integration.request.path.${name}`] = `method.request.path.${name}`
    );

    const s3pathParameters = integrationPath.match(/(?<=\{)[^}]+(?=\})/g) || [];
    for (const paramName of s3pathParameters) {
      if (!pathParameters.includes(paramName)) {
        if (!requestTemplates) {
          throw new Error(`The path parameter "${paramName}" is not exists in the path "${path}"`);
        } else {
          requestParameters[`integration.request.path.${paramName}`] = `method.request.path.${paramName}`
        }
      }
    }
    if (additionalRequestParameters) {
      Object.assign(requestParameters, additionalRequestParameters);
    }

    const normalResponseParameters = {
      'method.response.header.ETag': 'integration.response.header.ETag',
    };

    const errorResponseParameters = {
      'method.response.header.Content-Type': 'integration.response.header.Content-Type',
    };

    const integrationResponses = [
      {
        statusCode: "200",
        responseParameters: normalResponseParameters,
      }, {
        statusCode: "400",
        selectionPattern: "4\\d{2}",
        responseParameters: errorResponseParameters,
      }, {
        statusCode: "500",
        selectionPattern: "5\\d{2}",
        responseParameters: errorResponseParameters,
      },
    ];

    return this.put(path, new AwsIntegration({
      service: "s3",
      integrationHttpMethod: "PUT",
      path: integrationPath,
      subdomain: bucket.bucketName,
      options: {
        credentialsRole,
        requestParameters,
        requestTemplates,
        integrationResponses,
      },
    }), {
      ...methodOptions,
      requestParameters: RestApiBuilder.booleanMapForValue(requestParameters),
      methodResponses: RestApiBuilder.methodResponsesFrom(integrationResponses),
    });
  }

  public static methodResponsesFrom(integrationResponses: IntegrationResponse[]): MethodResponse[] {
    return integrationResponses.map(ir => ({
      statusCode: ir.statusCode,
      responseParameters: RestApiBuilder.booleanMapForKey(ir.responseParameters ?? {}),
    }));
  }

  private static booleanMapForKey(stringToStringMap: { [name: string]: string }): { [name: string]: boolean } {
    return Object.keys(stringToStringMap).reduce((result, key) => {
      result[key] = true;
      return result;
    }, {} as { [name: string]: boolean });
  }

  private static booleanMapForValue(stringToStringMap: { [name: string]: string }): { [name: string]: boolean } {
    return Object.values(stringToStringMap).reduce((result, key) => {
      result[key] = true;
      return result;
    }, {} as { [name: string]: boolean });
  }
}
