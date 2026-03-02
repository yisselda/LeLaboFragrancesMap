output "pages_url" {
  description = "GitHub Pages URL"
  value       = "https://${var.github_owner}.github.io/${var.repository_name}/"
}

output "repository_url" {
  description = "GitHub repository URL"
  value       = github_repository.this.html_url
}
