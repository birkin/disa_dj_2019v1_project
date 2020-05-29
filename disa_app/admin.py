import json, logging

from disa_app.models import UserProfile, MarkedForDeletion
from django.contrib import admin
from django.forms import ModelForm, ValidationError


log = logging.getLogger(__name__)


class MarkedForDeletionAdminForm(ModelForm):
    class Meta:
        model = MarkedForDeletion
        fields = '__all__'

    def clean_json_data(self):
        log.debug( 'starting clean_json_data()' )
        json_data = self.cleaned_data['json_data']
        try:
            json.loads( json_data )
        except:
            message = 'problem saving entered json'
            log.exception( f'{message}; traceback follows; processing will halt' )
            raise ValidationError('invalid json')
        return json_data


class UserProfileAdmin(admin.ModelAdmin):
    list_display = [ 'id', 'user', 'uu_id', 'email', 'old_db_id', 'last_logged_in' ]
    readonly_fields = [ 'uu_id', 'last_logged_in' ]
    search_fields = [ 'uu_id', 'email', 'old_db_id' ]


class MarkedForDeletionAdmin(admin.ModelAdmin):
    list_display = [ 'id', 'old_db_id', 'doc_uu_id', 'json_data' ]
    search_fields = [ 'old_db_id', 'doc_uu_id', 'json_data' ]
    form = MarkedForDeletionAdminForm


admin.site.register( UserProfile, UserProfileAdmin )
admin.site.register( MarkedForDeletion, MarkedForDeletionAdmin )
