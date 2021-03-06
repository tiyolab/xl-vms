({  
    init : function(component, event, helper){
        console.log('init running');
        globalComponent = component;
        globalHelper = helper;
    },
    
    initCalendar : function(component, event, helper) {
        $("#calendar").fullCalendar({
            header: {
                right: 'month,agendaWeek,agendaDay',
                left: 'prev,next today',
                center: 'title'
            },
            timezone: false,
            selectable: true,
			selectHelper: true,
            editable: true,
            select : function(start, end){
                /**
                 * open create meeting modal
                 */
                var event = $A.get('e.c:event_open_create_meeting');
                event.setParams({
                    'startMeeting' : start.format('YYYY-MM-DD'),
                    'endMeeting' : helper.fromFullCalendar(end.format('YYYY-MM-DD'))
                });
                event.fire();
                
                $('#calendar').fullCalendar('unselect');
            },
            eventClick: function(event){
                helper.detailMeeting(component, event.id);
            }
        })
        
        console.log('ccv2');
	},
    
    handlerCreateMeeting : function(component, event, helper){
        
        var meeting = event.getParam('meeting');
        var attendees = JSON.parse(event.getParam('guests_email'));
        var timezone = event.getParam('timezone');
        
        var meetingMetadata = {
            'subject' : meeting.Subject__c,
            'room' : meeting.Room_Name,
            'description' : meeting.Description__c,
            'start_meeting' : meeting.Start_Meeting__c,
            'end_meeting' : meeting.End_Meeting__c,
            'attendees' : attendees,
            'timezone' : timezone
        }
        
        /**
         * send meeting metadata to iframe to save to google calendar api
         */
        document.getElementById('iframe').contentWindow.createCalendarEvent(meetingMetadata, component, function(status, eventCreated){
            if(status){
            	/**
            	 * save event id from calendar api to related meetings
            	 */
                var start_event = eventCreated.start.dateTime;
                var end_event = eventCreated.end.dateTime;
                                
                if (!start_event) {
                    start_event = eventCreated.start.date;
                }
                                
                if (!end_event) {
                    end_event = eventCreated.end.date;
                }
                
                helper.saveToServer(eventCreated.id, eventCreated.updated, start_event, end_event);
                
            }else{
                alert('Meeting not created');
                /**
                 * close spinner
                 */
                component.set('v.showSpinner', false);
            }
        });
    },
    
    handle_response_edit_meeting : function(component, event, helper){
        var meetings = event.getParam('meetings');
        var attendees = JSON.parse(event.getParam('guests_email'));
        var timezone = event.getParam('timezone');
        var sfMxIds = event.getParam('sfMxIds');
        
        var meetingMetadata = {
            'eventId' : meetings[0].Event_Id__c,
            'subject' : meetings[0].Subject__c,
            'room' : meetings[0].Room__c,
            'description' : meetings[0].Description__c,
            'start_meeting' : meetings[0].Start_Meeting__c,
            'end_meeting' : meetings[0].End_Meeting__c,
            'attendees' : attendees,
            'timezone' : timezone
        }
        
        /**
         * send meeting metadata to iframe to save to google calendar api
         */
        document.getElementById('iframe').contentWindow.updateCalendarEvent(meetingMetadata, function(status, eventCreated){
            if(status){
                /**
                 * render event to calendar
                 */
                var start_meeting = eventCreated.start.dateTime;
                var end_meeting = eventCreated.end.dateTime;
                            
                if(!start_meeting){
                    start_meeting = eventCreated.start.date;
                }
                            
                if(!end_meeting){
                    end_meeting = eventCreated.end.date;
                }
                
                var newMeeting = {
                    title : eventCreated.summary,
                    start : start_meeting,
                    end : end_meeting,
                    id : eventCreated.id
                }
                
                $("#calendar").fullCalendar('removeEvents', eventCreated.id);
                $("#calendar").fullCalendar('renderEvent', newMeeting, true);
                
                var eventU = $A.get('e.c:eventUpdateMaxIdnUpdatedTime');
                eventU.setParams({
                    'sfMxIds' : sfMxIds,
                    'lastUpdatedAt' : eventCreated.updated
                });
                eventU.fire();
                
            }
        });
        
        console.log('in end event');
    },
    
    handle_delete_meeting : function(component, event, helper){
        var eventId = event.getParam('eventId');
        document.getElementById('iframe').contentWindow.deleteEvent(eventId, function(status){
            if(status){
                alert('delete success');
                $("#calendar").fullCalendar('removeEvents', eventId);
            }
            
            /**
             * hide spinner
             */
            component.set('v.showSpinner', false);
        });
    },
    
    calendar_data_loaded : function(component, event, helper){
        //component.set('v.showSpinner', false);
    },
    
    handle_toggle_spinner : function(component, event, handler){
        component.set('v.showSpinner', event.getParam('isShow'));
    },
    
    handleSynchronizeBack : function(component, event, handler){
        
        var data = event.getParam('data');
        
      	var action = component.get('c.synchronizeWithCalendar');
        action.setParams({
            'sdata' : data
        });
        action.setCallback(this, function(response){
            var isHide = true;
            
            if(response.getReturnValue() != null){
                isHide = false;
             	
                var params = response.getReturnValue().params;
                var maximoId =  response.getReturnValue().maximoId;
                
                var actionG = component.get('c.updateToGallagher');
                actionG.setParams({
                    'params' : params,
                    'maximoId' : maximoId
                });
                actionG.setCallback(this, function(response2){
                    isHide = true;
                    
                    if(response2.getReturnValue() != null){
                        isHide = false;
                        
                        var actionUMaxId = component.get('c.updateMxMeetingId');
                        actionUMaxId.setParams({
                            'sfmxMeetingIds' : response2.getReturnValue()
                        });
                        actionUMaxId.setCallback(this, function(response3){
                            if(response3.getReturnValue()){
                                alert('Synchronize finish');
                            }
                            
                            component.set('v.showSpinner', false);
                        });
                        $A.enqueueAction(actionUMaxId);    
                    }
                    
                    if(isHide){
                        component.set('v.showSpinner', false);
                    }
                });
                $A.enqueueAction(actionG);
            }
            
            if(isHide){
                component.set('v.showSpinner', false);
            }
        });
        $A.enqueueAction(action);  
    },
    
    test_function : function(component){
       
    }
})