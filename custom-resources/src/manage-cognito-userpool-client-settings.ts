import { APIGatewayProxyHandler } from 'aws-lambda';
import 'source-map-support/register';
import * as AWS from 'aws-sdk';
import { CloudformationCustomResource, IdempotentCustomResourceHandle } from './cloudformation-custom-resource';

export const handler: APIGatewayProxyHandler = async (event: any, _context)  => {
    let result = await new IdempotentCustomResourceHandle( {
        customResource: new CustomCognitoUserPoolClientSettings(),
        deleteToUpdate: false,
        failIfUnexpectedPresence: false
    }).processCustomResource(event, _context);
    return result;
}

class CustomCognitoUserPoolClientSettings implements CloudformationCustomResource {
    async isPresent(): Promise<boolean> {
        return false;
    }    
    async create(event: any): Promise<string> {
        await this.update(event);
        return `${event.ResourceProperties.UserPoolClientId}-settings`;
    }
    async update(event: any): Promise<void> {
        var cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();                
        await cognitoIdentityServiceProvider.updateUserPoolClient({
            UserPoolId: event.ResourceProperties.UserPoolId,
            ClientId: event.ResourceProperties.UserPoolClientId,
            SupportedIdentityProviders: event.ResourceProperties.SupportedIdentityProviders,
            CallbackURLs: event.ResourceProperties.CallbackURLs,
            LogoutURLs: event.ResourceProperties.LogoutURLs,
            AllowedOAuthFlowsUserPoolClient: (event.ResourceProperties.AllowedOAuthFlowsUserPoolClient == 'true'),
            AllowedOAuthFlows: event.ResourceProperties.AllowedOAuthFlows,
            AllowedOAuthScopes: event.ResourceProperties.AllowedOAuthScopes
        }).promise();    
    }
    async delete(): Promise<void> {
        return;
    }
}
