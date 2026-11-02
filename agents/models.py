"""Shared request/response models for the Forgevyn dev-team CLI."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SpecialistId = Literal["design", "core", "backend"]


class FeatureRequest(BaseModel):
    feature: str = Field(..., min_length=1)
    specialist: SpecialistId


class FileChange(BaseModel):
    path: str = ""
    change: str = ""


class DevPlan(BaseModel):
    """A single specialist's plan for one feature."""

    feature: str = ""
    specialist: str = ""
    summary: str = ""
    implementation_steps: list[str] = Field(default_factory=list)
    files: list[FileChange] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    test_plan: list[str] = Field(default_factory=list)
    deepseek_prompt: str = ""


class FeatureResult(BaseModel):
    feature: str
    specialist: str
    plan: DevPlan | None = None
    error: str | None = None


class PlanBundle(BaseModel):
    generated_at: str
    repo_root: str
    model: str
    mode: Literal["crew", "dry-run"]
    results: list[FeatureResult] = Field(default_factory=list)
