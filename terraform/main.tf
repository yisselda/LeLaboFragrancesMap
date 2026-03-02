terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

provider "github" {
  owner = var.github_owner
}

resource "github_repository" "this" {
  name        = var.repository_name
  description = "Le Labo City Exclusives: a quiet, city-first fragrance explorer."
  homepage_url = "https://${var.github_owner}.github.io/${var.repository_name}/?view=dial&city=Paris"

  visibility = "public"
  has_issues  = true

  topics = [
    "le-labo",
    "city-exclusives",
    "fragrance",
    "react",
    "leaflet",
    "editorial-ui"
  ]

  pages {
    build_type = "workflow"
  }
}

resource "github_branch_protection" "main" {
  repository_id = github_repository.this.node_id
  pattern       = "main"

  required_pull_request_reviews {
    required_approving_review_count = 0
  }
}
