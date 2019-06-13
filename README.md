# cognito-sso-azure
sample scripts and instructions for setting up single sign on with Cognito and Azure AD

## TLDR;

 1. Configure the parameter files with your settings
 2. Deploy the stack
 3. Request an Azure Enterprise Application and obtain your Manifest XML
 4. Bundle the Manifest XML in the app and check it in
 5. Start using single sign on

## Ways to use Single Sign on

 Possibly the simplest method is to use an Application Load Balancer in front of the resource you want to protect. This has a number of benefits:
 
 * requires no changes to the resource you are protecting
 * configuring ALB listener rule to use Cognito is simple
 * re-usable by multiple applications
 

## Inventory of scripts

Here is a list of scripts and files, and their purpose.

* `scriptymcscr.ipt`

## Detailed Instructions

### Configuring parameter files

### Deploy the stack

### Request Azure Enterprise Application

### Bundle the EA Manifest file

### Configure SSO for your requirements
