import { APIGatewayProxyHandler } from 'aws-lambda';
import 'source-map-support/register';
import * as AWS from 'aws-sdk';
import {readFileSync, readdirSync } from 'fs';
import { CloudformationCustomResource, IdempotentCustomResourceHandle } from './cloudformation-custom-resource';
import { DescribeIdentityProviderResponse } from 'aws-sdk/clients/cognitoidentityserviceprovider';

export const handler: APIGatewayProxyHandler = async (event: any, _context)  => {
    let result = await new IdempotentCustomResourceHandle( {
        customResource: new CustomCognitoUserPoolIdentityProvider,
        deleteToUpdate: true,
        failIfUnexpectedPresence: false
    }).processCustomResource(event, _context);
    return result;
}

class CustomCognitoUserPoolIdentityProvider implements CloudformationCustomResource {
    cognitoIdentityServiceProvider: AWS.CognitoIdentityServiceProvider;
    constructor() {
        this.cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
    }
    async isPresent(event: any): Promise<boolean> {
        try {
            let identityProvider:DescribeIdentityProviderResponse = await this.cognitoIdentityServiceProvider.describeIdentityProvider({
                ProviderName: event.ResourceProperties.ProviderName,
                UserPoolId: event.ResourceProperties.UserPoolId
            }).promise();
            return identityProvider && identityProvider.IdentityProvider.ProviderName === event.ResourceProperties.ProviderName;
        } catch (e) {
            return false;
        }
    }

    async create(event: any): Promise<string> {
        let path = '';
        if ( process.env.LAMBDA_TASK_ROOT ) {
            path = process.env.LAMBDA_TASK_ROOT;
        } else {
            path = __dirname;
        }
        let files = await readdirSync(path);
        console.log(files);
        let metadataFile = await readFileSync( `${path}/${event.ResourceProperties.MetadataFile}`).toString();
        await this.cognitoIdentityServiceProvider.createIdentityProvider( {
            ProviderName: event.ResourceProperties.ProviderName,
            ProviderType: 'SAML',
            ProviderDetails: {
                MetadataFile: metadataFile
            },
            UserPoolId: event.ResourceProperties.UserPoolId,
            AttributeMapping: event.ResourceProperties.AttributeMapping
        }).promise();
        return event.ResourceProperties.ProviderName;
    }

    async update(event: any): Promise<void> {
        let path = '';
        if ( process.env.LAMBDA_TASK_ROOT ) {
            path = process.env.LAMBDA_TASK_ROOT;
        } else {
            path = __dirname;
        }
        let files = await readdirSync(path);
        console.log(files);
        let metadataFile = await readFileSync( `${path}/${event.ResourceProperties.MetadataFile}`).toString();
        await this.cognitoIdentityServiceProvider.updateIdentityProvider( {
            ProviderName: event.ResourceProperties.ProviderName,
            ProviderDetails: {
                MetadataFile: metadataFile
            },
            UserPoolId: event.ResourceProperties.UserPoolId,
            AttributeMapping: event.ResourceProperties.AttributeMapping
        }).promise();
        return event.ResourceProperties.ProviderName; 
    }

    async delete(event: any) {
        await this.cognitoIdentityServiceProvider.deleteIdentityProvider( {
            ProviderName: event.ResourceProperties.ProviderName,
            UserPoolId: event.ResourceProperties.UserPoolId
        }).promise();
    }
}

