const pulumi = require('@pulumi/pulumi');
const aws = require('@pulumi/aws');
const awsx = require('@pulumi/awsx');

const vpc = new awsx.ec2.Vpc('custom', {
  cidrBlock: '172.16.8.0/24',
  numberOfAvailabilityZones: 'all',
  numberOfNatGateways: 1,
});

const sg = new awsx.ec2.SecurityGroup('webserver-sg', {vpc});

sg.createIngressRule('http-access', {
  location: new awsx.ec2.AnyIPv4Location(),
  ports: new awsx.ec2.TcpPorts(80),
  description: 'allow HTTP access from anywhere',
});

sg.createIngressRule('https-access', {
  location: new awsx.ec2.AnyIPv4Location(),
  ports: new awsx.ec2.TcpPorts(443),
  description: 'allow HTTPS access from anywhere',
});

sg.createEgressRule('outbound-access', {
  location: new awsx.ec2.AnyIPv4Location(),
  ports: new awsx.ec2.AllTcpPorts(),
  description: 'allow outbound access to anywhere',
});

const ami = pulumi.output(aws.getAmi({
  filters: [{
    name: 'name',
    values: ['amzn-ami-hvm-*-x86_64-ebs'],
  }],
  owners: ['137112412989'], // This owner ID is Amazon
  mostRecent: true,
}));

const role = new aws.iam.Role('instance-role', {
  assumeRolePolicy: {
    'Version': '2008-10-17',
    'Statement': [
      {
        'Sid': '',
        'Effect': 'Allow',
        'Principal': {'Service': 'ec2.amazonaws.com'},
        'Action': 'sts:AssumeRole',
      },
    ],
  },
  path: '/',
});

const rolePolicyAttachment = new aws.iam.RolePolicyAttachment('rpa', {
  role: role,
  policyArn: aws.iam.ManagedPolicies.AmazonSSMManagedInstanceCore,
});

const profile = new aws.iam.InstanceProfile('instance-profile', {role});

const userData =
  `#!/bin/bash
echo 'Hello, World!<br>' > index.html
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone | sed 's/\\(.*\\)[a-z]/\\1/')
echo "You are in region: \${REGION}<br>" >> index.html
PRIVATE_IP=$(curl http://169.254.169.254/latest/meta-data/local-ipv4)
echo "Private IP Address: \${PRIVATE_IP}<br>" >> index.html
PUBLIC_IP=$(curl http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Public IP Address: \${PUBLIC_IP}<br>" >> index.html
nohup python -m SimpleHTTPServer 80 &`;

const server = new aws.ec2.Instance('webserver', {
  instanceType: 't3a.micro',
  vpcSecurityGroupIds: [sg.id], // reference the security group resource above
  subnetId: pulumi.output(vpc.publicSubnetIds)[0],  // reference the public subnet from the custom vpc above
  ami: ami.id,
  userData: userData,
  iamInstanceProfile: profile,
});

exports.publicIp = server.publicIp;
exports.publicHostName = server.publicDns;
exports.instanceId = server.id;
