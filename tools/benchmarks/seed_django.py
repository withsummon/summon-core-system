"""Create a new isolated local benchmark workspace; never overwrite an existing one."""
import json
import os

from django.db import transaction
from plane.db.models import User, Profile, Workspace, WorkspaceMember, Project, ProjectMember, State, Issue

slug = os.environ["SUMMON_BENCH_SLUG"]
password = os.environ["SUMMON_BENCH_PASSWORD"]
count = int(os.environ.get("SUMMON_BENCH_ROWS", "500"))
with transaction.atomic():
    if Workspace.objects.filter(slug=slug).exists():
        raise RuntimeError("Benchmark workspace already exists; choose a fresh run ID")
    user = User.objects.create_user(username=slug, email=f"{slug}@example.test", password=password, first_name="Benchmark", last_name="Owner")
    workspace = Workspace.objects.create(name="Migration benchmark", slug=slug, owner=user)
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=20, is_active=True)
    project = Project.objects.create(workspace=workspace, name="Benchmark project", identifier="BENCH", network=0)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=20, is_active=True)
    todo = State.objects.create(workspace=workspace, project=project, name="Todo", group="unstarted", color="#808080", sequence=1)
    done = State.objects.create(workspace=workspace, project=project, name="Done", group="completed", color="#008800", sequence=2)
    issues = []
    for i in range(count):
        issues.append(Issue.objects.create(workspace=workspace, project=project, name=f"Benchmark task {i+1:04d}", description_html="<p>Benchmark description</p>", state=todo, created_by=user))
    Profile.objects.update_or_create(user=user, defaults={"is_onboarded":True,"is_tour_completed":True,"last_workspace_id":workspace.id,"onboarding_step":{"profile_complete":True,"workspace_create":True,"workspace_invite":True,"workspace_join":True}})
print(json.dumps({"slug":slug,"email":user.email,"projectId":str(project.id),"taskId":str(issues[-1].id),"todoId":str(todo.id),"doneId":str(done.id),"rowCount":count}))
