# -*- coding: utf-8 -*-

from django.contrib import admin
from disa_app.models import UserProfile, MarkedForDeletion


class UserProfileAdmin(admin.ModelAdmin):
    list_display = [ 'id', 'user', 'uu_id', 'email', 'old_db_id', 'last_logged_in' ]
    readonly_fields = [ 'uu_id', 'last_logged_in' ]
    search_fields = [ 'uu_id', 'email', 'old_db_id' ]


class MarkedForDeletionAdmin(admin.ModelAdmin):
    list_display = [ 'id', 'old_db_id', 'doc_uu_id', 'json_data' ]


admin.site.register( UserProfile, UserProfileAdmin )
admin.site.register( MarkedForDeletion, MarkedForDeletionAdmin )
