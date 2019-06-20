#!/bin/bash
set -e
# reset

# script to convert Codepipeline format parameters to cloudformation stack parameter files
# usage:
#   $ cat codepipeline-params.json | to-cfn-params.sh
# 
# uses JQ locally if available, otherwise downloads it via docker image

echo "Make sure you piped in your parameter file, otherwise nothing will happen. E.g.:"
echo ""
echo "  ./init.sh < pipeline.json"
echo ""

while read stdin; do PIPELINEJSON=$PIPELINEJSON$stdin ; done
PIPELINEJSON=`echo "$PIPELINEJSON"|jq -c '.|tojson'`
CFN_QUERY=".|fromjson|.Parameters|to_entries|map({ParameterKey:(.key),ParameterValue:(.value)})|tojson"
STACK_QUERY=".|fromjson|.Parameters.NamingKebab"

function dojq {
    QUERY=$1
    JSON=$2
    LOCAL_JQ=`which jq`
    JQ_CMD="jq -r $QUERY"
    if [ -z "$LOCAL_JQ" ]; then
        docker run -t --rm --name jq endeveit/docker-jq \
            sh -c "echo '$JSON' |jq -r '$QUERY'"
    else
        # echo $JSON
       echo $JSON | $JQ_CMD
    fi
}

# set the aws profile to be used
PROFILE=default
if [ ! -z "$AWS_PROFILE" ] ; then
    PROFILE="$AWS_PROFILE"
    unset AWS_PROFILE
fi

# set the stack name
STACK_NAME=pipeline-$(dojq $STACK_QUERY $PIPELINEJSON)
echo "Stack Name is $STACK_NAME"
# make a temp file for cfn parameters
PARAMFILE=$(mktemp)
# convert the parameters
dojq $CFN_QUERY $PIPELINEJSON > $PARAMFILE

AWSCFN="aws --profile $PROFILE cloudformation"

echo "Create the initial CloudFormation Stack"
$AWSCFN create-stack --stack-name ${STACK_NAME} --template-body file://pipeline.yml --parameters file://${PARAMFILE} --capabilities "CAPABILITY_NAMED_IAM" --enable-termination-protection
echo "Waiting for the CloudFormation stack to finish being created."
$AWSCFN wait stack-create-complete --stack-name ${STACK_NAME}
# Print out all the CloudFormation outputs.
$AWSCFN describe-stacks --stack-name ${STACK_NAME} --output table --query "Stacks[0].Outputs"

export CODECOMMIT_REPO=`$AWSCFN describe-stacks --stack-name ${STACK_NAME} --output text --query "Stacks[0].Outputs[?OutputKey=='CodeCommitRepositoryCloneUrlHttp'].OutputValue"`

echo "New codecommit repository is $CODECOMMIT_REPO"
rm -f $PARAMFILE
