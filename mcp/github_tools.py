import os
import json
import base64
import urllib.request
import urllib.error
from datetime import datetime
from typing import Optional, Dict, Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)

def load_dotenv():
    env_paths = [
        os.path.join(PARENT_DIR, ".env"),
        os.path.join(BASE_DIR, ".env"),
        "/opt/my-website/.env",
        "/app/.env",
        r"d:\BO\Work\lau-nha\.env"
    ]
    for env_path in env_paths:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k and k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

load_dotenv()

def get_github_token() -> str:
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        load_dotenv()
        token = os.environ.get("GITHUB_TOKEN", "")
    return token

def get_github_repo() -> str:
    repo = os.environ.get("GITHUB_REPO", "")
    if not repo:
        load_dotenv()
        repo = os.environ.get("GITHUB_REPO", "tangductri123/lau-nha")
    return repo

def _github_api(endpoint: str, method: str = 'GET', data: Optional[dict] = None) -> dict:
    token = get_github_token()
    repo = get_github_repo()
    clean_endpoint = endpoint.lstrip('/')
    url = f"https://api.github.com/repos/{repo}/{clean_endpoint}"
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GoClaw-Cameo-Agent'
    }
    req_data = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f"GitHub API {method} {clean_endpoint} failed ({e.code}): {error_body}")
    except Exception as e:
        raise Exception(f"GitHub API error: {str(e)}")


def exec_github_get_file(file_path: str, branch: str = "main") -> dict:
    """Đọc nội dung của một file từ GitHub repository."""
    try:
        data = _github_api(f"contents/{file_path.lstrip('/')}?ref={branch}")
        content = base64.b64decode(data['content']).decode('utf-8')
        return {
            "success": True,
            "file_path": file_path,
            "branch": branch,
            "sha": data.get("sha"),
            "size": data.get("size"),
            "content": content
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def exec_github_create_pull_request(
    file_path: str,
    new_content: str,
    commit_message: str,
    pr_title: str,
    pr_body: str,
    branch_name: Optional[str] = None
) -> dict:
    """Tạo nhánh mới, cập nhật file và tạo Pull Request tự động lên GitHub."""
    try:
        if not branch_name:
            timestamp = datetime.now().strftime("%m%d-%H%M%S")
            clean_file = os.path.basename(file_path).replace(".", "-")
            branch_name = f"cameo/{clean_file}-{timestamp}"

        # 1. Lấy SHA của commit mới nhất trên nhánh main
        main_ref = _github_api('git/ref/heads/main')
        main_sha = main_ref['object']['sha']

        # 2. Tạo nhánh mới từ main
        try:
            _github_api('git/refs', method='POST', data={
                'ref': f"refs/heads/{branch_name}",
                'sha': main_sha
            })
        except Exception as e:
            if "Reference already exists" not in str(e):
                raise e

        # 3. Lấy SHA của file cũ nếu đã tồn tại trên nhánh mới
        file_sha = None
        try:
            existing_file = _github_api(f"contents/{file_path.lstrip('/')}?ref={branch_name}")
            file_sha = existing_file.get('sha')
        except Exception:
            pass

        # 4. Commit file mới lên nhánh
        encoded_content = base64.b64encode(new_content.encode('utf-8')).decode('utf-8')
        commit_payload = {
            'message': commit_message,
            'content': encoded_content,
            'branch': branch_name
        }
        if file_sha:
            commit_payload['sha'] = file_sha

        _github_api(f"contents/{file_path.lstrip('/')}", method='PUT', data=commit_payload)

        # 5. Mở Pull Request
        pr_data = _github_api('pulls', method='POST', data={
            'title': pr_title,
            'body': pr_body,
            'head': branch_name,
            'base': 'main'
        })

        return {
            "success": True,
            "pr_url": pr_data['html_url'],
            "pr_number": pr_data['number'],
            "branch": branch_name,
            "title": pr_title,
            "message": f"Đã tạo Pull Request #{pr_data['number']} thành công! Sếp duyệt tại: {pr_data['html_url']}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
