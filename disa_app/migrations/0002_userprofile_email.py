# -*- coding: utf-8 -*-
# Generated by Django 1.11.25 on 2020-02-25 15:50
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('disa_app', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
    ]
