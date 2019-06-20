# cognito-sso-azure
sample scripts and instructions for setting up authentication using Open ID Connect (OIDC) single sign on with AWS Cognito, ALB and Azure AD

## TLDR;

 1. Configure the parameter files with your settings
 2. Deploy the stack
 3. Request an Azure Enterprise Application and obtain your Manifest XML
 4. Bundle the Manifest XML in the app and check it in
 5. Start using single sign on

## Ways to use Single Sign on

 Using AWS Cognito, ALB and Azure AD is an easy way to provide authentication for another backend resource such as EC2, ECS, Lambda targets residing behind a load balancer.
 
 ALB supports configuring a rule to first authenticate using Cognito before forwarding to your target. This is also included in this stack, if you provide an ALB listener ARN.

 This straight-forward solution has the following benefits
 
 * requires no changes to the resource you are protecting
 * configuring ALB listener rule to use Cognito is simple
 * re-usable by multiple applications
 
## Inventory of scripts

Here is a list of scripts and files, and their purpose.

* `init.sh` - bootstrap script to deploy the cognito CICD pipeline stack
* `pipeline.yml` - cloudformation template that defines inception pipeline and roles to manage cognito pipeline
* `pipeline.json` - parameter file for the inception pipeline, where the base name for resources is defined
* `buildspec.yml` - CodeBuild buildspec to build and deploy Cloudformation custom resources to manage Cognito API calls that Cloudformation itself does not support yet
* `cognito.yml` - cloudformation template that defines cognito stack components
* `cognito.json` - parameter file for the cognito stack. set domains and callback URLs, for example
* `custom-resources/` - folder containing Cloudformation custom resources and source code

## Detailed Instructions

Following these instructions should be enough to get you a working OIDC Cognito / Azure AD Authentication pattern, managed by a CICD pipeline

### Configuring parameter files

The first step is to configure the two parameter files, `pipeline.json` and `cognito.json`

file | parameter | description
| --- | --- | --- |
pipeline.json | NamingPascal | Personal naming of your stack in Pascal case (for role naming)
pipeline.json | NamingKebab |  Personal naming of your stack in Kebab case (for everything else)
cognito.json | CognitoDomain | the subdomain for your cognito auth domain - this will form part of reply URL in Azure AD Enterprise Application
cognito.json | CallbackURLs | comma separated list of callback URLs - see note about these below
cognito.json | LogoutURLs | comma separated list of logout URLs, if you have configured this feature
cognito.json | ManifestPresent | set to true once you have added your metadata xml file to `custom-resources/azure/` folder. If this is false (i.e. if you don't have metadata XML yet) then Cloudformation won't deploy the Cognito User Pool Identity Provider


#### Callback URLs
Callback URLs should point to the loadbalancer, or a DNS name that points to the load balancer. In addition, they should use the suffix /oauth2/idpresponse. For example, if your loadbalancer is
>     `uuid-uuid.elb.us-east-1.amazonaws.com`
then the corresponding callback URL would be
> `https://uuid-uuid.elb.us-east-1.amazonaws.com/oauth2/idpresponse`


### Deploy the stack

Once you have configured your parameter files, you can deploy the pipeling as follows:

 `$ ./init.sh < pipeline.json`

 After the stacks have been deployed, the URL for the new CodeCommit repository generated for the pipeline will be printed. Add it as a remote, commit your changes and push the repository. E.g.: 

 `$ git remote add cc https://.....codecommit/repo`
 `$ git add -A`
 `$ git commit -m "deploying my cognito stack"`
 `$ git push cc -f`

 By pushing the source into the new repo, the pipeline will be up to date with the source and changes to your repo will kick off the CICD pipeline

### Request Azure Enterprise Application

Work with your Azure Portal team to have an Enterpise Application set up. You will need to 
supply them parameters such as:

Parameter | Description
| -- | -- |
Name of the Application | Identifies your application to administrators
Reply URL | this requires your cognito subdomain, the region its deployed in, and should be of the form https://**your-cognito-subdomain**.auth.**region**.amazoncognito.com/saml2/idpresponse
Identitier (Entity ID) | this is based on your user pool id and should be of the form urn:amazon:cognito:sp:**user-pool-id**
Token Claims | these may be defaulted or overridden but should be something like: 
* Givenname – user.givenname
* Surname – user.surname
* Emailaddress – user.mail
* Name – user.userprincipalname
* Unique User Identifier – user.userprincipalname or user.onpremisessamaccountname


### Bundle the EA Manifest file

Once you have set up an Azure AD Enterprise Application, you will be provided a metadata XML document has important information. You need to: 
* rename the file to match the name of your cognito domain. E.g. if your cognito domain is `my-application`, then rename the XML file to `my-application.xml`
* copy the file to the directory called `custom-resources/azure/` in the cognito repository you cloned above
* check in the file to your repository and let the pipeline run. It will set up the Cognito Identity Provider using the XML file you provided

### Configure SSO for your requirements

A sample load balancer listener rule has been defined in the `cognito.yml` stack, but you will likely want to change it to point to a target group, instead of returning a fixed response. Again, this is outside the scope of this document but easily updated by ECS resources, for example.
