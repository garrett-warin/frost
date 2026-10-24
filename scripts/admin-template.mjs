import { writeFile } from 'node:fs/promises';
const ref=x=>({Ref:x}),get=(x,y)=>({'Fn::GetAtt':[x,y]}),sub=s=>({'Fn::Sub':s});
const template={AWSTemplateFormatVersion:'2010-09-09',Description:'Frost isolated TOTP admin console',Parameters:{CodeBucket:{Type:'String'},CodeKey:{Type:'String'},SetupHash:{Type:'String',NoEcho:true}},Resources:{
 State:{Type:'AWS::DynamoDB::Table',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{BillingMode:'PAY_PER_REQUEST',AttributeDefinitions:[{AttributeName:'id',AttributeType:'S'}],KeySchema:[{AttributeName:'id',KeyType:'HASH'}],TimeToLiveSpecification:{AttributeName:'expires',Enabled:true},SSESpecification:{SSEEnabled:true}}},
 Role:{Type:'AWS::IAM::Role',Properties:{AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]},Policies:[{PolicyName:'FrostAdminState',PolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['dynamodb:GetItem','dynamodb:PutItem','dynamodb:UpdateItem','dynamodb:DeleteItem'],Resource:get('State','Arn')}]}}]}},
 Function:{Type:'AWS::Lambda::Function',Properties:{Runtime:'nodejs22.x',Handler:'index.handler',Role:get('Role','Arn'),Timeout:15,MemorySize:256,Code:{S3Bucket:ref('CodeBucket'),S3Key:ref('CodeKey')},Environment:{Variables:{TABLE_NAME:ref('State'),SETUP_HASH:ref('SetupHash')}}}},
 FunctionUrl:{Type:'AWS::Lambda::Url',Properties:{AuthType:'AWS_IAM',TargetFunctionArn:get('Function','Arn')}},
 OriginAccess:{Type:'AWS::CloudFront::OriginAccessControl',Properties:{OriginAccessControlConfig:{Name:sub('${AWS::StackName}-origin'),OriginAccessControlOriginType:'lambda',SigningBehavior:'always',SigningProtocol:'sigv4'}}},
 NoCache:{Type:'AWS::CloudFront::CachePolicy',Properties:{CachePolicyConfig:{Name:sub('${AWS::StackName}-no-cache'),DefaultTTL:0,MinTTL:0,MaxTTL:0,ParametersInCacheKeyAndForwardedToOrigin:{EnableAcceptEncodingGzip:false,CookiesConfig:{CookieBehavior:'none'},HeadersConfig:{HeaderBehavior:'none'},QueryStringsConfig:{QueryStringBehavior:'none'}}}}},
 ForwardHeaders:{Type:'AWS::CloudFront::OriginRequestPolicy',Properties:{OriginRequestPolicyConfig:{Name:sub('${AWS::StackName}-admin-headers'),CookiesConfig:{CookieBehavior:'none'},QueryStringsConfig:{QueryStringBehavior:'none'},HeadersConfig:{HeaderBehavior:'whitelist',Headers:['Origin','Content-Type','X-Frost-Session','X-Frost-Setup','X-Amz-Content-Sha256']}}}},
 Distribution:{Type:'AWS::CloudFront::Distribution',Properties:{DistributionConfig:{Enabled:true,Comment:'Frost Admin Console — TOTP protected',HttpVersion:'http2',IPV6Enabled:true,PriceClass:'PriceClass_100',Origins:[{Id:'FrostAdminLambda',DomainName:{'Fn::Select':[2,{'Fn::Split':['/',get('FunctionUrl','FunctionUrl')]}]},OriginAccessControlId:ref('OriginAccess'),CustomOriginConfig:{OriginProtocolPolicy:'https-only',OriginSSLProtocols:['TLSv1.2']}}],DefaultCacheBehavior:{TargetOriginId:'FrostAdminLambda',ViewerProtocolPolicy:'https-only',AllowedMethods:['GET','HEAD','OPTIONS','PUT','PATCH','POST','DELETE'],CachedMethods:['GET','HEAD'],CachePolicyId:ref('NoCache'),OriginRequestPolicyId:ref('ForwardHeaders'),Compress:true},ViewerCertificate:{CloudFrontDefaultCertificate:true}}}},
 UrlPermission:{Type:'AWS::Lambda::Permission',Properties:{Action:'lambda:InvokeFunctionUrl',FunctionName:ref('Function'),Principal:'cloudfront.amazonaws.com',SourceArn:sub('arn:aws:cloudfront::${AWS::AccountId}:distribution/${Distribution}')}},
 InvokePermission:{Type:'AWS::Lambda::Permission',Properties:{Action:'lambda:InvokeFunction',FunctionName:ref('Function'),Principal:'cloudfront.amazonaws.com',SourceArn:sub('arn:aws:cloudfront::${AWS::AccountId}:distribution/${Distribution}')}}
},Outputs:{Domain:{Value:get('Distribution','DomainName')},DistributionId:{Value:ref('Distribution')},Table:{Value:ref('State')},FunctionName:{Value:ref('Function')},OriginUrl:{Value:get('FunctionUrl','FunctionUrl')}}};
delete template.Resources.ForwardHeaders;
template.Resources.Distribution.Properties.DistributionConfig.DefaultCacheBehavior.OriginRequestPolicyId='b689b0a8-53d0-40ab-baf2-68738e2966ac';
// Retain the original distribution URL as the public browser entry point.
template.Resources.AdminDistribution=structuredClone(template.Resources.Distribution);
const browser=template.Resources.Distribution.Properties.DistributionConfig;
browser.Comment='Frost browser';
browser.Origins=[{Id:'FrostFly',DomainName:'frost-browsing.fly.dev',CustomOriginConfig:{OriginProtocolPolicy:'https-only',OriginSSLProtocols:['TLSv1.2'],OriginReadTimeout:60}}];
browser.DefaultCacheBehavior.TargetOriginId='FrostFly';
browser.DefaultCacheBehavior.ViewerProtocolPolicy='redirect-to-https';
for(const name of ['UrlPermission','InvokePermission']) template.Resources[name].Properties.SourceArn=sub('arn:aws:cloudfront::${AWS::AccountId}:distribution/${AdminDistribution}');
template.Outputs.AdminDomain={Value:get('AdminDistribution','DomainName')};
template.Outputs.AdminDistributionId={Value:ref('AdminDistribution')};
for(let i=1;i<=5;i++) {
 const name='BrowserDistribution'+i;
 template.Resources[name]=structuredClone(template.Resources.Distribution);
 template.Resources[name].Properties.DistributionConfig.Comment='Frost browser additional '+i;
 template.Outputs['BrowserDomain'+i]={Value:get(name,'DomainName')};
 template.Outputs['BrowserDistributionId'+i]={Value:ref(name)};
}
await writeFile('admin/stack.json',JSON.stringify(template,null,2));
