import { MethodResponse, MockIntegration, PassthroughBehavior } from "aws-cdk-lib/aws-apigateway";
import { RestApiBuilder } from "./RestApiBuilder";

export interface TextMockIntegrationOptions {
  body?: string;

  responseTemplate?: string;

  /**
   * The value of the content-type header.
   * 
   * @default text/plain
   */
  contentType?: string;
}

export class TextMockIntegration extends MockIntegration {
  methodResponses: MethodResponse[];

  constructor(options: TextMockIntegrationOptions) {
    const {
      body,
      responseTemplate,
      contentType = "text/plain",
    } = options;

    if ((body !== undefined) === (responseTemplate !== undefined)) {
      throw new Error('Either "body" or "responseTemplate must be specified');
    }

    const integrationResponses = [
      {
        statusCode: "200",
        responseTemplates: {
          "application/json": responseTemplate ?? `#[[${body}]]#`,
        },
        responseParameters: {
          "method.response.header.Content-Type": `'${contentType}'`,
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
