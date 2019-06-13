import { APIGatewayProxyHandler } from 'aws-lambda';
import 'source-map-support/register';
import * as AWS from 'aws-sdk';
import { CloudformationCustomResource, IdempotentCustomResourceHandle } from './cloudformation-custom-resource';
import { DescribeResourceServerResponse } from 'aws-sdk/clients/cognitoidentityserviceprovider';

export const handler: APIGatewayProxyHandler = async (event: any, _context)  => {
    let result = await new IdempotentCustomResourceHandle( {
        customResource: new CustomCognitoUserPoolResourceServer,
        deleteToUpdate: true,
        failIfUnexpectedPresence: false
    }).processCustomResource(event, _context);
    return result;
}

class CustomCognitoUserPoolResourceServer implements CloudformationCustomResource {
    cognito: AWS.CognitoIdentityServiceProvider;
    constructor() {
        this.cognito = new AWS.CognitoIdentityServiceProvider();
    }

    async isPresent(event: any): Promise<boolean> {
        let { Identifier, UserPoolId } = event.ResourceProperties.ResourceServer;
        let result: DescribeResourceServerResponse;
            try {
                result = await this.cognito.describeResourceServer( { UserPoolId: UserPoolId, Identifier: Identifier}).promise();
                console.log(result);
            } catch (e) {
                console.log(e.toString());
                return false;
            }
        return result && result.ResourceServer && result.ResourceServer.Identifier === Identifier;
    }    

    async create(event: any): Promise<string> {
        let { Identifier, Name, Scopes, UserPoolId } = event.ResourceProperties.ResourceServer;
        let createResourceServerResult = await this.cognito
            .createResourceServer({ Identifier, Name, Scopes, UserPoolId })
            .promise();
        return createResourceServerResult.ResourceServer ? createResourceServerResult.ResourceServer.Identifier : undefined;
    }

    update: undefined

    async delete(event: any): Promise<void> {
        let { UserPoolId } = event.ResourceProperties.ResourceServer;
        let Identifier = event.PhysicalResourceId;
        await this.cognito.deleteResourceServer({ UserPoolId, Identifier }).promise();
    }
}