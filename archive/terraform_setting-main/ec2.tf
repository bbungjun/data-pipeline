data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_eip" "backend" {
  domain   = "vpc"
  instance = aws_instance.backend.id

  tags = {
    Name = "${var.project_name}-backend-eip"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_instance" "backend" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.ec2_instance_type
  key_name                    = var.key_pair_name
  subnet_id                   = aws_subnet.public[0].id
  iam_instance_profile        = aws_iam_instance_profile.backend_ec2_log_pipeline.name
  vpc_security_group_ids      = [aws_security_group.backend.id]
  associate_public_ip_address = true

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true

    tags = {
      Environment = "dev"
      ManagedBy   = "terraform"
      Project     = "mmr-pipeline"
    }
  }

  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail

    dnf update -y
    dnf install -y git htop awscli python3 cronie amazon-cloudwatch-agent

    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    npm install -g pm2

    sudo -u ec2-user bash -c 'pm2 startup systemd -u ec2-user --hp /home/ec2-user' | tail -1 | sudo bash
    sudo -u ec2-user mkdir -p /home/ec2-user/apps

    mkdir -p /opt/gmok-log-pipeline
    aws s3 sync "s3://${aws_s3_bucket.log_pipeline_assets.id}/${local.asset_prefix}" /opt/gmok-log-pipeline

    mkdir -p /opt/gmok-log-pipeline/config /opt/gmok-log-pipeline/.state /opt/gmok-log-pipeline/logs
    chmod +x /opt/gmok-log-pipeline/deploy/ec2/*.sh || true

    echo "Node.js: $(node -v)" > /home/ec2-user/setup_done.txt
    echo "npm: $(npm -v)" >> /home/ec2-user/setup_done.txt
    echo "pm2: $(sudo -u ec2-user pm2 -v)" >> /home/ec2-user/setup_done.txt
  EOF

  user_data_replace_on_change = false

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      ami,
      user_data,
    ]
  }

  tags = {
    Name = "${var.project_name}-backend-ec2"
  }

  depends_on = [
    aws_iam_instance_profile.backend_ec2_log_pipeline,
    aws_s3_object.pipeline_assets,
  ]
}
