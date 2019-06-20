import { APIGatewayProxyHandler } from 'aws-lambda';
import 'source-map-support/register';
import * as AWS from 'aws-sdk';
import { CloudformationCustomResource, IdempotentCustomResourceHandle } from './cloudformation-custom-resource';
import { DescribeUserPoolDomainResponse } from 'aws-sdk/clients/cognitoidentityserviceprovider';

export const handler: APIGatewayProxyHandler = async (event: any, _context)  => {
    let result = await new IdempotentCustomResourceHandle( {
        customResource: new CustomCognitoUserPoolDomain(),
        deleteToUpdate: true,
        failIfUnexpectedPresence: false,
        ignoreDeleteFailure: true
    }).processCustomResource(event, _context);
    return result;
}

class CustomCognitoUserPoolDomain implements CloudformationCustomResource {
    cognitoIdentityServiceProvider: AWS.CognitoIdentityServiceProvider;
    constructor() {
        this.cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
    }
    async isPresent(event: any): Promise<boolean> {
        let result: DescribeUserPoolDomainResponse;
        try {
            result = await this.cognitoIdentityServiceProvider
                    .describeUserPoolDomain({ Domain: event.ResourceProperties.Domain })
                    .promise();
        } catch (e) {
            console.log(e.toString());
        } 
        let response =  result.DomainDescription && result.DomainDescription.Status === 'ACTIVE';
        return response;
    }  
    
    async create(event: any): Promise<string> {
        await this.cognitoIdentityServiceProvider.createUserPoolDomain({
            UserPoolId: event.ResourceProperties.UserPoolId,
            Domain: event.ResourceProperties.Domain
        }).promise();
        return event.ResourceProperties.Domain;
    }

    update: undefined;

    async delete(event: any): Promise<void> {
        await this.cognitoIdentityServiceProvider.deleteUserPoolDomain({
            UserPoolId: event.ResourceProperties.UserPoolId,
            Domain: event.ResourceProperties.Domain
        }).promise();
        console.log('deleted user pool domain');
        let retries = 3;
        do {
            
            if ( await this.isPresent(event) && retries-- > 0 ) {
                console.log('waiting for 10s while domain completes deletion');
                await new Promise( resolve => setTimeout(resolve, 10000));
                continue;
            }
            break;
        } while ( true );
    }
}
