import { MethodResponse, MockIntegration, PassthroughBehavior } from "aws-cdk-lib/aws-apigateway";
import { RestApiBuilder } from "./RestApiBuilder";

export interface RedirectMockIntegrationOptions {
  /**
   * HTTP status code.
   * 
   * @default 302
   */
  statusCode?: number;

  location: string;
}

export class RedirectMockIntegration extends MockIntegration {
  methodResponses: MethodResponse[];

  constructor(options: RedirectMockIntegrationOptions) {
    const {
      statusCode = 302,
      location,
    } = options;

    const integrationResponses = [
      {
        statusCode: `${statusCode}`,
        responseParameters: {
          "method.response.header.Location": `'${location}'`,
        },
      },
    ];

    super({
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{ "statusCode": 200 }',
      },
      integrationResponses,
    });

    this.methodResponses = RestApiBuilder.methodResponsesFrom(integrationResponses);
  }
}
