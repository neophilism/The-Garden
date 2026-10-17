"""Emit one small, secret-free checkout receipt into each job's authenticated log."""
import json
import os
import re
import subprocess


def receipt():
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    headers = subprocess.check_output(['git', 'cat-file', '-p', 'HEAD'], text=True).split('\n\n', 1)[0]
    parents = [line.split(' ', 1)[1] for line in headers.splitlines() if line.startswith('parent ')]
    if not re.fullmatch(r'[a-f0-9]{40}', sha) or any(not re.fullmatch(r'[a-f0-9]{40}', p) for p in parents):
        raise ValueError('Invalid Git object identity')
    if os.environ.get('GITHUB_SHA') != sha:
        raise ValueError('Checked-out revision does not match the workflow revision')
    return {
        'schema_version': 1,
        'repository': os.environ.get('GITHUB_REPOSITORY'),
        'event': os.environ.get('GITHUB_EVENT_NAME'),
        'workflow_ref': os.environ.get('GITHUB_WORKFLOW_REF'),
        'workflow_run_id': os.environ.get('GITHUB_RUN_ID'),
        'run_attempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
        'job': os.environ.get('GITHUB_JOB'),
        'tested_sha': sha,
        'parent_shas': parents,
    }


if __name__ == '__main__':
    print('GARDEN_CI_SOURCE=' + json.dumps(receipt(), sort_keys=True, separators=(',', ':')))
