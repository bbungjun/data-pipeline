output "backend_sg_id" {
  description = "Backend EC2 security group ID"
  value       = aws_security_group.backend.id
}

output "rds_sg_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "lambda_sg_id" {
  description = "Lambda security group ID"
  value       = aws_security_group.lambda.id
}

output "my_ip" {
  description = "Detected public IP used for SSH allowlisting"
  value       = local.my_ip_cidr
}

output "backend_public_ip" {
  description = "Backend EC2 public IP"
  value       = aws_eip.backend.public_ip
}

output "backend_private_ip" {
  description = "Backend EC2 private IP"
  value       = aws_instance.backend.private_ip
}

output "ssh_command" {
  description = "SSH connection command"
  value       = "ssh -i /path/to/${var.key_pair_name}.pem ec2-user@${aws_eip.backend.public_ip}"
}

output "rds_endpoint" {
  description = "RDS endpoint in host:port format"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "RDS hostname"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "RDS port"
  value       = aws_db_instance.main.port
}

output "rds_db_name" {
  description = "Initial RDS database name"
  value       = aws_db_instance.main.db_name
}

output "rds_username" {
  description = "RDS master username"
  value       = aws_db_instance.main.username
}

output "rds_secret_arn" {
  description = "Secrets Manager ARN for the RDS master password"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}
