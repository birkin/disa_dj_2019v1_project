# -*- coding: utf-8 -*-
# Generated by Django 1.11.28 on 2020-05-29 15:14
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('disa_app', '0006_userprofile_can_delete_doc'),
    ]

    operations = [
        migrations.CreateModel(
            name='MarkedForDeletion',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('old_db_id', models.IntegerField()),
                ('doc_uu_id', models.UUIDField(default='init')),
                ('json_data', models.TextField()),
            ],
        ),
    ]
