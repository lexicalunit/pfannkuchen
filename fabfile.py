import logging
import yaml

from fabric.api import lcd, env, task
from fabric.contrib.project import rsync_project


logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger()


try:
    conf = yaml.load(open('deploy.yaml', 'rb').read())
except:
    log.exception('error: unable to read deply.yaml config file:')

env.user = conf['user']
env.hosts = ['{}@{}:22'.format(env.user, host) for host in conf['hosts']]


def deploy_project(local_dir, remote_dir, exclusions=[]):
    """Deploy the entire project at local_dir to remote_dir, excluding the given paths."""
    with lcd(local_dir):
        rsync_project(remote_dir=remote_dir, local_dir='.', exclude=exclusions)
    rsync_project(remote_dir=remote_dir, local_dir='resources', exclude=exclusions, delete=True)


@task
def deploy():
    """Deploys web and script to remote server."""
    deploy_project('web', conf['web_remote_dir'],
                   ['.git', 'fabfile.py', 'cache', 'config', 'template'])
    deploy_project('script', conf['script_remote_dir'],
                   ['.git', 'fabfile.py', 'cache', 'js', 'image'])